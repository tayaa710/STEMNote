/**
 * Supabase Edge Functions API Client
 *
 * Provides typed functions to call Supabase Edge Functions with robust error handling.
 * All functions return ApiResponse<T> which is a discriminated union - check result.ok
 * to determine success/failure.
 */

import Config from 'react-native-config';

// ============ Types ============

export interface ApiResult<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code: 'NETWORK_ERROR' | 'HTTP_ERROR' | 'PARSE_ERROR' | 'CONFIG_ERROR';
  status?: number;
}

export type ApiResponse<T> = ApiResult<T> | ApiError;

// Health check response
export interface HealthResponse {
  ok: boolean;
  time: string;
  version: string;
}

// Ask region types
export interface AskRegionRequest {
  folderId: string; // For RAG context retrieval from indexed pages
  pageId: string;
  regionImageBase64: string;
  question: string;
}

export interface AskRegionCitation {
  id: string;
  title: string;
  snippet: string;
  sourceType: 'page' | 'region'; // 'page' = from indexed content, 'region' = current selection
  noteId?: string; // For navigation to source page
  pageIndex?: number; // 0-based index for navigation
}

export interface AskRegionResponse {
  answer: string;
  citations: AskRegionCitation[];
}

export interface IndexPageRequest {
  folderId: string;
  noteId: string;
  pageId: string;
  pageIndex: number;
  pageImageBase64: string;
}

export interface IndexPageResponse {
  ok: boolean;
  chunksUpserted: number;
  extractedTextLength?: number;
}

export interface IndexPdfRequest {
  noteId: string;
  pdfBase64: string;
}

export interface IndexPdfResponse {
  indexed: boolean;
  pageCount: number;
}

// ============ Configuration ============

function getConfig(): {url: string; anonKey: string} | null {
  const url = Config.SUPABASE_URL;
  const anonKey = Config.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('[apiClient] Missing Supabase configuration');
    return null;
  }

  return {url, anonKey};
}

// ============ Core Request Function ============

async function callEdgeFunction<TReq, TRes>(
  functionName: string,
  body?: TReq,
): Promise<ApiResponse<TRes>> {
  const config = getConfig();

  if (!config) {
    return {
      ok: false,
      error: 'Supabase not configured. Check .env file.',
      code: 'CONFIG_ERROR',
    };
  }

  const url = `${config.url}/functions/v1/${functionName}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        apikey: config.anonKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle non-2xx responses
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorBody.message || errorMessage;
      } catch {
        // Ignore JSON parse errors for error response
      }

      return {
        ok: false,
        error: errorMessage,
        code: 'HTTP_ERROR',
        status: response.status,
      };
    }

    // Parse successful response
    try {
      const data = (await response.json()) as TRes;
      return {ok: true, data};
    } catch {
      return {
        ok: false,
        error: 'Failed to parse response JSON',
        code: 'PARSE_ERROR',
      };
    }
  } catch (networkError) {
    const message =
      networkError instanceof Error
        ? networkError.message
        : 'Network request failed';

    return {
      ok: false,
      error: message,
      code: 'NETWORK_ERROR',
    };
  }
}

// ============ Public API Functions ============

/**
 * Check if the backend is healthy and reachable.
 * Use this for testing connectivity.
 */
export async function checkHealth(): Promise<ApiResponse<HealthResponse>> {
  return callEdgeFunction<undefined, HealthResponse>('health');
}

/**
 * Ask a question about a selected region of a page.
 * (Stub - not yet implemented on backend)
 */
export async function askRegion(
  request: AskRegionRequest,
): Promise<ApiResponse<AskRegionResponse>> {
  return callEdgeFunction<AskRegionRequest, AskRegionResponse>(
    'askRegion',
    request,
  );
}

/**
 * Index a page image for RAG retrieval.
 * Extracts text from the page image, chunks it, generates embeddings,
 * and stores chunks in the database for future RAG queries.
 */
export async function indexPage(
  request: IndexPageRequest,
): Promise<ApiResponse<IndexPageResponse>> {
  return callEdgeFunction<IndexPageRequest, IndexPageResponse>(
    'indexPage',
    request,
  );
}

/**
 * Index a PDF document for RAG retrieval.
 * (Stub - not yet implemented on backend)
 */
export async function indexPdf(
  request: IndexPdfRequest,
): Promise<ApiResponse<IndexPdfResponse>> {
  return callEdgeFunction<IndexPdfRequest, IndexPdfResponse>(
    'indexPdf',
    request,
  );
}
