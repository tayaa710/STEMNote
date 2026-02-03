import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS headers (same pattern as other functions)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Types
interface IndexPageRequest {
  folderId: string;
  noteId: string;
  pageId: string;
  pageIndex: number;
  pageImageBase64: string;
}

interface IndexPageResponse {
  ok: boolean;
  chunksUpserted: number;
  extractedTextLength?: number;
}

interface ErrorResponse {
  error: string;
  code: string;
}

interface ChunkRow {
  folder_id: string;
  source_type: "page";
  source_id: string;
  page_index: number;
  chunk_text: string;
  embedding: number[];
  metadata: {
    noteId: string;
    extractedAt: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

// Constants
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const AI_TIMEOUT_MS = 55000; // 55s
const CHUNK_SIZE_CHARS = 1000; // ~250 tokens at 4 chars/token
const CHUNK_OVERLAP_CHARS = 200; // ~50 tokens overlap

// System prompt for text extraction
const EXTRACTION_PROMPT = `You are a text extraction assistant for a STEM note-taking app.

Extract ALL readable text from this handwritten/typed note image. Include:
- All text, equations, formulas, and mathematical expressions
- Diagram labels and annotations
- Any headers, titles, or section markers

Format rules:
- Preserve the logical reading order (top-to-bottom, left-to-right)
- Convert mathematical notation to LaTeX where appropriate (e.g., \\frac{a}{b}, x^2, \\sqrt{x})
- Separate distinct sections with double newlines
- If text is illegible, mark it as [illegible]
- If there is no text, return exactly: [empty page]

Return ONLY the extracted text, no commentary or explanation.`;

// Helper: Create error response
function errorResponse(
  message: string,
  code: string,
  status: number
): Response {
  const body: ErrorResponse = { error: message, code };
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// Helper: Create success response
function successResponse(data: IndexPageResponse): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// Helper: Extract text from image using GPT-4o
async function extractTextFromImage(
  apiKey: string,
  imageBase64: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: EXTRACTION_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: "Extract all text from this note page.",
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "[indexPage] OpenAI extraction error:",
        response.status,
        errorBody
      );

      if (response.status === 429) {
        throw new Error("RATE_LIMITED");
      }
      throw new Error("AI_ERROR");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    return content || "[empty page]";
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("TIMEOUT");
    }
    throw error;
  }
}

// Helper: Split text into chunks with overlap
function chunkText(text: string): string[] {
  // Handle empty or very short text
  if (!text || text === "[empty page]" || text.trim().length === 0) {
    return [];
  }

  // If text is short enough, return as single chunk
  if (text.length <= CHUNK_SIZE_CHARS) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    // Calculate end position for this chunk
    let end = Math.min(start + CHUNK_SIZE_CHARS, text.length);

    // If not at the end of text, try to break at a sentence or word boundary
    if (end < text.length) {
      // Look for sentence boundary (., !, ?) within last 100 chars of chunk
      const searchStart = Math.max(end - 100, start);
      const searchText = text.slice(searchStart, end);
      const sentenceMatch = searchText.match(/[.!?]\s+[A-Z]/g);

      if (sentenceMatch) {
        // Find last sentence boundary
        const lastMatch = searchText.lastIndexOf(
          sentenceMatch[sentenceMatch.length - 1]
        );
        end = searchStart + lastMatch + 2; // Include period and space
      } else {
        // Fall back to word boundary
        const lastSpace = text.lastIndexOf(" ", end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start position, accounting for overlap
    start = end - CHUNK_OVERLAP_CHARS;
    if (start >= text.length) {
      break;
    }
  }

  return chunks;
}

// Helper: Generate embeddings for text chunks
async function generateEmbeddings(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      "[indexPage] OpenAI embeddings error:",
      response.status,
      errorBody
    );

    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error("EMBEDDING_ERROR");
  }

  const result = await response.json();

  // OpenAI returns embeddings in order corresponding to input
  const embeddings = result.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);

  return embeddings;
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    // Check for required environment variables
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("[indexPage] OPENAI_API_KEY not configured");
      return errorResponse("AI service not configured", "API_KEY_MISSING", 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[indexPage] Supabase config not available");
      return errorResponse(
        "Database service not configured",
        "DB_CONFIG_MISSING",
        500
      );
    }

    // Create Supabase client with service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body: IndexPageRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
    }

    const { folderId, noteId, pageId, pageIndex, pageImageBase64 } = body;

    // Validate required fields
    if (
      !folderId ||
      !noteId ||
      !pageId ||
      pageIndex === undefined ||
      !pageImageBase64
    ) {
      return errorResponse(
        "Missing required fields: folderId, noteId, pageId, pageIndex, pageImageBase64",
        "MISSING_PARAMS",
        400
      );
    }

    // Validate image size
    const imageSizeBytes = (pageImageBase64.length * 3) / 4;
    if (imageSizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return errorResponse(
        "Image is too large. Maximum 4MB.",
        "IMAGE_TOO_LARGE",
        400
      );
    }

    console.log(
      `[indexPage] Starting indexing for pageId: ${pageId}, folderId: ${folderId}`
    );

    // Step 1: Extract text from image
    let extractedText: string;
    try {
      extractedText = await extractTextFromImage(openaiKey, pageImageBase64);
      console.log(
        `[indexPage] Extracted ${extractedText.length} chars from page`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[indexPage] Text extraction failed:", errorMessage);

      if (errorMessage === "RATE_LIMITED") {
        return errorResponse(
          "Too many requests. Please wait a moment.",
          "RATE_LIMITED",
          429
        );
      }
      if (errorMessage === "TIMEOUT") {
        return errorResponse("Request timed out. Please try again.", "TIMEOUT", 504);
      }
      return errorResponse(
        "Failed to extract text from image",
        "EXTRACTION_ERROR",
        500
      );
    }

    // Step 2: Chunk the text
    const chunks = chunkText(extractedText);
    console.log(`[indexPage] Created ${chunks.length} chunks`);

    // If no chunks (empty page), delete existing and return success
    if (chunks.length === 0) {
      // Delete any existing chunks for this page
      const { error: deleteError } = await supabase
        .from("chunks")
        .delete()
        .eq("source_type", "page")
        .eq("source_id", pageId);

      if (deleteError) {
        console.error("[indexPage] Delete error:", deleteError);
      }

      console.log(`[indexPage] Empty page, no chunks to store for pageId: ${pageId}`);
      return successResponse({
        ok: true,
        chunksUpserted: 0,
        extractedTextLength: 0,
      });
    }

    // Step 3: Generate embeddings
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(openaiKey, chunks);
      console.log(`[indexPage] Generated ${embeddings.length} embeddings`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[indexPage] Embedding generation failed:", errorMessage);

      if (errorMessage === "RATE_LIMITED") {
        return errorResponse(
          "Too many requests. Please wait a moment.",
          "RATE_LIMITED",
          429
        );
      }
      return errorResponse(
        "Failed to generate embeddings",
        "EMBEDDING_ERROR",
        500
      );
    }

    // Step 4: Delete existing chunks for this page
    const { error: deleteError } = await supabase
      .from("chunks")
      .delete()
      .eq("source_type", "page")
      .eq("source_id", pageId);

    if (deleteError) {
      console.error("[indexPage] Delete error:", deleteError);
      return errorResponse(
        "Failed to update existing chunks",
        "DB_DELETE_ERROR",
        500
      );
    }

    // Step 5: Insert new chunks
    const now = new Date().toISOString();
    const chunkRows: ChunkRow[] = chunks.map((chunkText, index) => ({
      folder_id: folderId,
      source_type: "page" as const,
      source_id: pageId,
      page_index: pageIndex,
      chunk_text: chunkText,
      embedding: embeddings[index],
      metadata: {
        noteId,
        extractedAt: now,
        chunkIndex: index,
        totalChunks: chunks.length,
      },
    }));

    const { error: insertError } = await supabase.from("chunks").insert(chunkRows);

    if (insertError) {
      console.error("[indexPage] Insert error:", insertError);
      return errorResponse("Failed to store chunks", "DB_INSERT_ERROR", 500);
    }

    console.log(
      `[indexPage] Successfully indexed pageId: ${pageId} with ${chunks.length} chunks`
    );

    return successResponse({
      ok: true,
      chunksUpserted: chunks.length,
      extractedTextLength: extractedText.length,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[indexPage] Unexpected error:", errorMessage);

    return errorResponse("An unexpected error occurred", "INTERNAL_ERROR", 500);
  }
});
