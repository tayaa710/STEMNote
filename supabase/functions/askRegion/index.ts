import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS headers (same pattern as health function)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Types
interface AskRegionRequest {
  folderId: string;
  pageId: string;
  regionImageBase64: string;
  question: string;
}

interface Citation {
  id: string;
  title: string;
  snippet: string;
  sourceType: "page" | "region";
  noteId?: string;
  pageIndex?: number;
}

interface AskRegionResponse {
  answer: string;
  citations: Citation[];
}

interface ErrorResponse {
  error: string;
  code: string;
}

interface ChunkRow {
  id: string;
  source_id: string;
  page_index: number;
  chunk_text: string;
  metadata: {
    noteId?: string;
    noteName?: string;
  } | null;
  similarity: number;
}

// Constants
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_QUESTION_LENGTH = 1000;
const AI_TIMEOUT_MS = 55000; // 55s (leave buffer for Supabase's 60s limit)
const RAG_TOP_K = 12; // Number of chunks to retrieve for similarity search
const MIN_SIMILARITY = 0.15; // Minimum similarity threshold for similarity search
const SMALL_FOLDER_THRESHOLD = 30; // If folder has <= this many chunks, include ALL (no similarity filtering)

// System prompt for OpenAI (base)
const SYSTEM_PROMPT_BASE = `You are an AI assistant for a STEM note-taking application. You help students understand their handwritten notes, diagrams, equations, and mathematical work.

When analyzing the image:
1. Identify the subject matter (math, physics, chemistry, biology, etc.)
2. Focus on answering the user's specific question
3. If the image contains equations or formulas, explain the steps or concepts
4. Be concise but thorough - aim for 2-4 paragraphs
5. If you cannot clearly see or understand part of the image, say so

Do not make up information that isn't visible in the image.`;

// System prompt addition when RAG context is available
const RAG_CONTEXT_INSTRUCTION = `

You also have access to relevant content from the user's other notes in this folder. When this context helps answer the question, use it and cite your sources using [Source N] format (e.g., [Source 1], [Source 2]).

Only cite sources when you actually use information from them. If the image alone is sufficient to answer the question, you don't need to cite any sources.`;

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
function successResponse(data: AskRegionResponse): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// Helper: Get embedding for text using OpenAI
async function getEmbedding(apiKey: string, text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[askRegion] Embedding API error:", response.status, errorBody);
    throw new Error("EMBEDDING_ERROR");
  }

  const result = await response.json();
  return result.data[0].embedding;
}

// Helper: Count chunks in a folder
async function countChunksInFolder(
  supabase: ReturnType<typeof createClient>,
  folderId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .eq("folder_id", folderId);

  if (error) {
    console.error("[askRegion] Chunk count error:", error);
    return 0;
  }

  return count || 0;
}

// Helper: Retrieve ALL chunks from folder (for small folders)
async function retrieveAllChunks(
  supabase: ReturnType<typeof createClient>,
  folderId: string
): Promise<ChunkRow[]> {
  const { data, error } = await supabase
    .from("chunks")
    .select("id, source_id, page_index, chunk_text, metadata")
    .eq("folder_id", folderId)
    .order("page_index", { ascending: true });

  if (error) {
    console.error("[askRegion] All chunks retrieval error:", error);
    return [];
  }

  // Add a dummy similarity score of 1.0 for all chunks (they're all "relevant")
  return (data || []).map(chunk => ({
    ...chunk,
    similarity: 1.0,
  }));
}

// Helper: Retrieve similar chunks from database (for large folders)
async function retrieveSimilarChunks(
  supabase: ReturnType<typeof createClient>,
  folderId: string,
  queryEmbedding: number[]
): Promise<ChunkRow[]> {
  // Use pgvector similarity search
  // The <=> operator computes cosine distance, so we use 1 - distance for similarity
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_folder_id: folderId,
    match_count: RAG_TOP_K,
    min_similarity: MIN_SIMILARITY,
  });

  if (error) {
    console.error("[askRegion] Chunk retrieval error:", error);
    // Return empty array on error - we'll fall back to image-only
    return [];
  }

  return data || [];
}

// Helper: Build context string from chunks
function buildContextString(chunks: ChunkRow[]): string {
  if (chunks.length === 0) return "";

  const contextParts = chunks.map((chunk, index) => {
    const sourceLabel = chunk.metadata?.noteName
      ? `${chunk.metadata.noteName} - Page ${(chunk.page_index || 0) + 1}`
      : `Page ${(chunk.page_index || 0) + 1}`;
    return `[Source ${index + 1}: ${sourceLabel}]\n${chunk.chunk_text}`;
  });

  return contextParts.join("\n\n");
}

// Helper: Build citations from chunks
function buildCitations(chunks: ChunkRow[]): Citation[] {
  return chunks.map((chunk, index) => {
    const title = chunk.metadata?.noteName
      ? `${chunk.metadata.noteName} - Page ${(chunk.page_index || 0) + 1}`
      : `Page ${(chunk.page_index || 0) + 1}`;

    // Truncate snippet to ~100 chars
    const snippet =
      chunk.chunk_text.length > 100
        ? chunk.chunk_text.substring(0, 100) + "..."
        : chunk.chunk_text;

    return {
      id: `source-${index + 1}`,
      title,
      snippet,
      sourceType: "page" as const,
      noteId: chunk.metadata?.noteId,
      pageIndex: chunk.page_index,
    };
  });
}

// Helper: Call OpenAI API with timeout
async function callOpenAI(
  apiKey: string,
  imageBase64: string,
  question: string,
  ragContext: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  // Build system prompt with or without RAG context
  let systemPrompt = SYSTEM_PROMPT_BASE;
  if (ragContext) {
    systemPrompt += RAG_CONTEXT_INSTRUCTION;
  }

  // Build user message content
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${imageBase64}`,
      },
    },
    {
      type: "text",
      text: question,
    },
  ];

  // Add RAG context if available
  if (ragContext) {
    userContent.push({
      type: "text",
      text: `\n\n---\nRelevant context from your notes:\n${ragContext}\n---`,
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500, // Slightly increased for citations
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[askRegion] OpenAI API error:", response.status, errorBody);

      if (response.status === 429) {
        throw new Error("RATE_LIMITED");
      }
      throw new Error("AI_ERROR");
    }

    const result = await response.json();

    // Extract text from OpenAI's response
    const content = result.choices?.[0]?.message?.content;

    return content || "Unable to generate a response.";
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("TIMEOUT");
    }
    throw error;
  }
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
    // Check for API key
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("[askRegion] OPENAI_API_KEY not configured");
      return errorResponse(
        "AI service not configured",
        "API_KEY_MISSING",
        500
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[askRegion] Supabase not configured");
      return errorResponse(
        "Database not configured",
        "CONFIG_ERROR",
        500
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body: AskRegionRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
    }

    const { folderId, pageId, regionImageBase64, question } = body;

    // Validate required fields
    if (!pageId || !regionImageBase64 || !question) {
      return errorResponse(
        "Missing required fields: pageId, regionImageBase64, question",
        "MISSING_PARAMS",
        400
      );
    }

    // Validate image size (base64 is ~4/3 larger than binary)
    const imageSizeBytes = (regionImageBase64.length * 3) / 4;
    if (imageSizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return errorResponse(
        "The selected region is too large. Please select a smaller area.",
        "IMAGE_TOO_LARGE",
        400
      );
    }

    // Validate question length
    if (question.length > MAX_QUESTION_LENGTH) {
      return errorResponse(
        "Question is too long. Maximum 1000 characters.",
        "QUESTION_TOO_LONG",
        400
      );
    }

    // RAG retrieval (only if folderId provided)
    let ragContext = "";
    let ragCitations: Citation[] = [];

    if (folderId) {
      try {
        console.log("[askRegion] Retrieving RAG context for folder:", folderId);

        // Count chunks in folder to decide retrieval strategy
        const chunkCount = await countChunksInFolder(supabase, folderId);
        console.log("[askRegion] Folder has", chunkCount, "chunks");

        let chunks: ChunkRow[] = [];

        if (chunkCount === 0) {
          console.log("[askRegion] No chunks indexed, using image-only");
        } else if (chunkCount <= SMALL_FOLDER_THRESHOLD) {
          // Small folder: include ALL chunks (no similarity filtering)
          console.log("[askRegion] Small folder - including ALL chunks");
          chunks = await retrieveAllChunks(supabase, folderId);
        } else {
          // Large folder: use similarity search
          console.log("[askRegion] Large folder - using similarity search");
          const queryEmbedding = await getEmbedding(openaiKey, question);
          chunks = await retrieveSimilarChunks(supabase, folderId, queryEmbedding);
        }

        if (chunks.length > 0) {
          console.log("[askRegion] Using", chunks.length, "chunks for context:");
          chunks.forEach((chunk, i) => {
            console.log(`  [${i + 1}] similarity=${chunk.similarity.toFixed(3)}, page=${chunk.page_index}, text="${chunk.chunk_text.substring(0, 50)}..."`);
          });
          ragContext = buildContextString(chunks);
          ragCitations = buildCitations(chunks);
        }
      } catch (ragError) {
        // Log but don't fail - fall back to image-only
        console.error("[askRegion] RAG retrieval failed:", ragError);
      }
    } else {
      console.log("[askRegion] No folderId provided, using image-only");
    }

    // Call OpenAI API
    let answer: string;
    try {
      answer = await callOpenAI(openaiKey, regionImageBase64, question, ragContext);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("[askRegion] AI call failed:", errorMessage);

      if (errorMessage === "RATE_LIMITED") {
        return errorResponse(
          "Too many requests. Please wait a moment.",
          "RATE_LIMITED",
          429
        );
      }
      if (errorMessage === "TIMEOUT") {
        return errorResponse(
          "Request timed out. Please try again.",
          "TIMEOUT",
          504
        );
      }
      return errorResponse(
        "AI service temporarily unavailable",
        "AI_ERROR",
        500
      );
    }

    // Build response with citations
    // Always include "current region" citation, plus any RAG citations
    const citations: Citation[] = [
      {
        id: "current-region",
        title: "Selected Region",
        snippet: "Based on the content visible in your selection",
        sourceType: "region",
      },
      ...ragCitations,
    ];

    const response: AskRegionResponse = {
      answer,
      citations,
    };

    console.log("[askRegion] Success for pageId:", pageId, "with", ragCitations.length, "RAG citations");
    return successResponse(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[askRegion] Unexpected error:", errorMessage);

    return errorResponse(
      "An unexpected error occurred",
      "INTERNAL_ERROR",
      500
    );
  }
});
