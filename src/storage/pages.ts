import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { Page } from '../types/models';

const PAGES_KEY = '@pages';

/**
 * Internal helper: Load all pages from AsyncStorage
 */
async function loadAll(): Promise<Page[]> {
  try {
    const json = await AsyncStorage.getItem(PAGES_KEY);
    if (!json) {
      return [];
    }
    const pages = JSON.parse(json) as Page[];
    return pages;
  } catch (error) {
    console.error('Failed to load pages:', error);
    return [];
  }
}

/**
 * Internal helper: Save all pages to AsyncStorage
 */
async function saveAll(pages: Page[]): Promise<void> {
  await AsyncStorage.setItem(PAGES_KEY, JSON.stringify(pages));
}

/**
 * Load pages for a specific note, sorted by pageIndex
 */
export async function loadPagesByNote(noteId: string): Promise<Page[]> {
  try {
    const allPages = await loadAll();
    const notesPages = allPages.filter(page => page.noteId === noteId);
    // Sort by pageIndex ascending
    return notesPages.sort((a, b) => a.pageIndex - b.pageIndex);
  } catch (error) {
    console.error('Failed to load pages for note:', noteId, error);
    return [];
  }
}

/**
 * Create a new page in the specified note and return pages for that note
 * New page will have pageIndex = maxExistingPageIndex + 1 (or 0 if first page)
 */
export async function createPage(noteId: string): Promise<Page[]> {
  try {
    const allPages = await loadAll();
    const notePages = allPages.filter(page => page.noteId === noteId);

    // Find max pageIndex for this note
    const maxIndex = notePages.length > 0
      ? Math.max(...notePages.map(p => p.pageIndex))
      : -1;

    const now = Date.now();
    const newPage: Page = {
      id: uuidv4(),
      noteId,
      pageIndex: maxIndex + 1,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...allPages, newPage];
    await saveAll(updated);

    // Return only pages for this note, sorted
    return updated
      .filter(page => page.noteId === noteId)
      .sort((a, b) => a.pageIndex - b.pageIndex);
  } catch (error) {
    console.error('Failed to create page:', error);
    throw error;
  }
}

/**
 * Ensure a page exists at the given pageIndex for the note.
 * If it doesn't exist, create it.
 * Returns all pages for the note.
 */
export async function ensurePageExists(
  noteId: string,
  pageIndex: number,
): Promise<Page[]> {
  try {
    const pages = await loadPagesByNote(noteId);

    // Check if page already exists at this index
    const existingPage = pages.find(p => p.pageIndex === pageIndex);
    if (existingPage) {
      return pages;
    }

    // Page doesn't exist, create it
    const allPages = await loadAll();
    const now = Date.now();
    const newPage: Page = {
      id: uuidv4(),
      noteId,
      pageIndex,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...allPages, newPage];
    await saveAll(updated);

    // Return pages for this note, sorted
    return updated
      .filter(page => page.noteId === noteId)
      .sort((a, b) => a.pageIndex - b.pageIndex);
  } catch (error) {
    console.error('Failed to ensure page exists:', error);
    throw error;
  }
}
