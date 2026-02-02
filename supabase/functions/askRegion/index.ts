import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// CORS headers (same pattern as health function)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Types
interface AskRegionRequest {
  pageId: string;
  regionImageBase64: string;
  question: string;
}

interface AskRegionResponse {
  answer: string;
  citations: Array<{ id: string; title: string; snippet: string }>;
}

interface ErrorResponse {
  error: string;
  code: string;
}

// Constants
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_QUESTION_LENGTH = 1000;
const AI_TIMEOUT_MS = 55000; // 55s (leave buffer for Supabase's 60s limit)

// System prompt for OpenAI
const SYSTEM_PROMPT = `You are an AI assistant for a STEM note-taking application. You help students understand their handwritten notes, diagrams, equations, and mathematical work.

When analyzing the image:
1. Identify the subject matter (math, physics, chemistry, biology, etc.)
2. Focus on answering the user's specific question
3. If the image contains equations or formulas, explain the steps or concepts
4. Be concise but thorough - aim for 2-4 paragraphs
5. If you cannot clearly see or understand part of the image, say so

Do not make up information that isn't visible in the image.`;

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

// Helper: Call OpenAI API with timeout
async function callOpenAI(
  apiKey: string,
  imageBase64: string,
  question: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
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
                text: question,
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

    // Parse request body
    let body: AskRegionRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
    }

    const { pageId, regionImageBase64, question } = body;

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

    // Call OpenAI API
    let answer: string;
    try {
      answer = await callOpenAI(openaiKey, regionImageBase64, question);
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

    // Build response with mock citations (for now)
    // In the future, citations could come from RAG retrieval
    const response: AskRegionResponse = {
      answer,
      citations: [
        {
          id: "current-region",
          title: "Selected Region",
          snippet: "Based on the content visible in your selection",
        },
      ],
    };

    console.log("[askRegion] Success for pageId:", pageId);
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
