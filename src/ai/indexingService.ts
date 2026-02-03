/**
 * Indexing Service
 *
 * Orchestrates page indexing for RAG retrieval. Handles:
 * - Rendering page drawing to base64 PNG
 * - Calling the indexPage API
 * - Updating local page index status
 */

import { indexPage } from './apiClient';
import { updatePageIndexStatus } from '../storage/pages';
import { loadDrawingData } from '../storage/drawings';
import {
  renderDrawingToPngBase64,
  getExportSizeForLogicalSize,
  ExportSize,
} from '../utils/exportDrawing';
import { Page, DrawingData } from '../types/models';

/**
 * Compute a simple hash of drawing data to detect content changes.
 * Uses a string representation of strokes for comparison.
 */
function computeDrawingHash(drawingData: DrawingData | null): string {
  if (!drawingData || drawingData.strokes.length === 0) {
    return 'empty';
  }

  // Create a deterministic string representation of the drawing
  // Include stroke count, point counts, and a sample of coordinates
  const strokeSummaries = drawingData.strokes.map(stroke => {
    const pointCount = stroke.points.length;
    // Sample first, middle, and last points for the hash
    const firstPoint = stroke.points[0];
    const midPoint = stroke.points[Math.floor(pointCount / 2)];
    const lastPoint = stroke.points[pointCount - 1];
    return `${stroke.id}:${pointCount}:${firstPoint?.x.toFixed(1)},${firstPoint?.y.toFixed(1)}:${midPoint?.x.toFixed(1)},${midPoint?.y.toFixed(1)}:${lastPoint?.x.toFixed(1)},${lastPoint?.y.toFixed(1)}`;
  });

  const hashInput = `v${drawingData.version}:${drawingData.strokes.length}:${strokeSummaries.join('|')}`;

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < hashInput.length; i++) {
    hash = ((hash << 5) + hash) + hashInput.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}

export interface IndexPageParams {
  page: Page;
  folderId: string;
  canvasSize: ExportSize;
}

export interface IndexNoteParams {
  pages: Page[];
  folderId: string;
  canvasSize: ExportSize;
  onProgress?: (indexed: number, total: number) => void;
}

export interface IndexNoteResult {
  totalPages: number;
  indexedPages: number;
  skippedPages: number;
  failedPages: number;
}

// Track pages currently being indexed to prevent duplicate requests
const indexingInProgress = new Set<string>();

// Cooldown period - don't re-index a page within this time (ms)
const INDEX_COOLDOWN_MS = 30000; // 30 seconds

// Track if a note is currently being indexed
let noteIndexingInProgress = false;

/**
 * Trigger indexing for a page. This function:
 * 1. Sets page status to 'queued' then 'running'
 * 2. Loads and renders the drawing to base64 PNG
 * 3. Calls the indexPage API
 * 4. Updates status to 'done' or 'error'
 *
 * This function does not throw - errors are reflected in the page's indexStatus.
 */
export async function triggerPageIndexing(params: IndexPageParams): Promise<void> {
  const { page, folderId, canvasSize } = params;

  // Skip if already indexing this page
  if (indexingInProgress.has(page.id)) {
    console.log(`[indexingService] Page ${page.id} already indexing, skipping`);
    return;
  }

  // Skip if page was indexed recently (within cooldown period)
  if (page.indexedAt && Date.now() - page.indexedAt < INDEX_COOLDOWN_MS) {
    console.log(`[indexingService] Page ${page.id} indexed recently, skipping`);
    return;
  }

  // Skip if page is already queued or running (based on stored status)
  if (page.indexStatus === 'queued' || page.indexStatus === 'running') {
    console.log(`[indexingService] Page ${page.id} status is ${page.indexStatus}, skipping`);
    return;
  }

  // Mark as in-progress
  indexingInProgress.add(page.id);

  // Set status to queued
  await updatePageIndexStatus(page.id, 'queued');

  try {
    // Set status to running
    await updatePageIndexStatus(page.id, 'running');

    // Load drawing data
    const drawingData = await loadDrawingData(page.id);

    // Check if page has any content to index
    if (!drawingData || drawingData.strokes.length === 0) {
      // Empty page - nothing to index, mark as done
      console.log(`[indexingService] Page ${page.id} is empty, skipping indexing`);
      await updatePageIndexStatus(page.id, 'done', Date.now());
      return;
    }

    // Render drawing to base64 PNG
    const outputSize = getExportSizeForLogicalSize(canvasSize);
    let imageBase64: string;

    try {
      imageBase64 = renderDrawingToPngBase64(drawingData, canvasSize, outputSize);
    } catch (renderError) {
      const message = renderError instanceof Error ? renderError.message : 'Render failed';
      console.error(`[indexingService] Failed to render page ${page.id}:`, message);
      await updatePageIndexStatus(page.id, 'error', null, message);
      return;
    }

    // Call the indexPage API
    const result = await indexPage({
      folderId,
      noteId: page.noteId,
      pageId: page.id,
      pageIndex: page.pageIndex,
      pageImageBase64: imageBase64,
    });

    if (result.ok) {
      console.log(
        `[indexingService] Successfully indexed page ${page.id}: ${result.data.chunksUpserted} chunks`
      );
      await updatePageIndexStatus(page.id, 'done', Date.now());
    } else {
      console.error(`[indexingService] API error for page ${page.id}:`, result.error);
      await updatePageIndexStatus(page.id, 'error', null, result.error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[indexingService] Unexpected error indexing page ${page.id}:`, message);
    await updatePageIndexStatus(page.id, 'error', null, message);
  } finally {
    // Always remove from in-progress set when done
    indexingInProgress.delete(page.id);
  }
}

/**
 * Index all pages in a note. This is the manual indexing function.
 * Processes pages sequentially to avoid rate limits.
 */
export async function indexNote(params: IndexNoteParams): Promise<IndexNoteResult> {
  const { pages, folderId, canvasSize, onProgress } = params;

  // Prevent concurrent note indexing
  if (noteIndexingInProgress) {
    console.log('[indexingService] Note indexing already in progress');
    return { totalPages: 0, indexedPages: 0, skippedPages: 0, failedPages: 0 };
  }

  noteIndexingInProgress = true;
  const result: IndexNoteResult = {
    totalPages: pages.length,
    indexedPages: 0,
    skippedPages: 0,
    failedPages: 0,
  };

  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      onProgress?.(i, pages.length);

      // Load drawing data to check if page has content and compute hash
      const drawingData = await loadDrawingData(page.id);
      const currentHash = computeDrawingHash(drawingData);

      // Skip empty pages
      if (!drawingData || drawingData.strokes.length === 0) {
        console.log(`[indexingService] Page ${page.id} is empty, marking as done`);
        await updatePageIndexStatus(page.id, 'done', Date.now(), null, 'empty');
        result.skippedPages++;
        continue;
      }

      // Skip if content hasn't changed AND was indexed recently
      const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;
      const contentUnchanged = page.lastIndexedHash === currentHash;
      const indexedRecently = page.indexedAt && Date.now() - page.indexedAt < MANUAL_COOLDOWN_MS;

      if (contentUnchanged && indexedRecently) {
        console.log(`[indexingService] Page ${page.id} unchanged and indexed recently, skipping`);
        result.skippedPages++;
        continue;
      }

      // Log why we're re-indexing
      if (!contentUnchanged) {
        console.log(`[indexingService] Page ${page.id} content changed (hash: ${page.lastIndexedHash} -> ${currentHash}), re-indexing`);
      } else {
        console.log(`[indexingService] Page ${page.id} cooldown expired, re-indexing`);
      }

      // Set status to running
      await updatePageIndexStatus(page.id, 'running');

      try {
        // Render drawing to base64 PNG
        const outputSize = getExportSizeForLogicalSize(canvasSize);
        const imageBase64 = renderDrawingToPngBase64(drawingData, canvasSize, outputSize);

        // Call the indexPage API
        const apiResult = await indexPage({
          folderId,
          noteId: page.noteId,
          pageId: page.id,
          pageIndex: page.pageIndex,
          pageImageBase64: imageBase64,
        });

        if (apiResult.ok) {
          console.log(`[indexingService] Indexed page ${i + 1}/${pages.length}: ${apiResult.data.chunksUpserted} chunks`);
          await updatePageIndexStatus(page.id, 'done', Date.now(), null, currentHash);
          result.indexedPages++;
        } else {
          console.error(`[indexingService] Failed page ${i + 1}/${pages.length}:`, apiResult.error);
          await updatePageIndexStatus(page.id, 'error', null, apiResult.error);
          result.failedPages++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[indexingService] Error indexing page ${i + 1}/${pages.length}:`, message);
        await updatePageIndexStatus(page.id, 'error', null, message);
        result.failedPages++;
      }

      // Small delay between pages to avoid rate limits
      if (i < pages.length - 1) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      }
    }

    onProgress?.(pages.length, pages.length);
    return result;
  } finally {
    noteIndexingInProgress = false;
  }
}

/**
 * Check if note indexing is currently in progress
 */
export function isNoteIndexingInProgress(): boolean {
  return noteIndexingInProgress;
}
