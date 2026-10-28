import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

export interface Env {
  GEMINI_API_KEY: string;
  ASSETS: {
    fetch: typeof fetch;
  };
}

const DEEP_SCAN_MODEL_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
] as const;

const REWRITE_SPAN_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
] as const;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    modelsToTry: readonly string[];
    contents: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
  }
): Promise<{ response: GenerateContentResponse; modelUsed: string }> {
  let lastError: unknown = null;

  for (const modelName of params.modelsToTry) {
    const abortSignal = AbortSignal.timeout(12000);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const sdkPromise = ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
          abortSignal,
        },
      });

      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Model ${modelName} timed out after 12000ms`));
        }, 12000);
      });

      const response = await Promise.race([sdkPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      return { response, modelUsed: modelName };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Unbot Worker Fallback] Model "${modelName}" failed (${errMsg}). Trying next model in chain...`
      );
    }
  }

  throw lastError;
}

async function handleDeepScan(request: Request, env: Env): Promise<Response> {
  try {
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: "GEMINI_API_KEY secret is not configured on this Worker." },
        500
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      existingMatches?: Array<{
        id: string;
        text: string;
        category: string;
        subcategory: string;
      }>;
    };

    const { text, existingMatches } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return jsonResponse(
        { error: "Text is required for Deep AI Scan." },
        400
      );
    }

    const ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const existingSummary =
      existingMatches && existingMatches.length > 0
        ? existingMatches
            .slice(0, 15)
            .map(
              (m, idx) =>
                `${idx + 1}. [ID: ${m.id}] (${m.subcategory}): "${m.text}"`
            )
            .join("\n")
        : "None provided.";

    const systemInstruction =
      `You are "Unbot", a ruthless, high-precision literary editor trained to detect subtle AI writing habits and rewrite robotic prose into sharp, concrete, human-sounding English.

Your job has two parts:
PART 1 — SEMANTIC AI PATTERNS (` +
      "`semanticIssues`" +
      `):
Scan the user's text for subtle AI patterns that regular expressions miss:
1. "Hermetically Sealed Paragraph" (category: "red"): Paragraphs or closing sentences of a paragraph that end with a self-contained mini-conclusion restating the paragraph's own topic sentence or moralizing instead of pulling the reader forward. CRITICAL: Extract the exact verbatim closing sentence (or clause) from the text as ` +
      "`exactQuote`" +
      `.
2. "Vague Authority Plural" (category: "yellow"): Phrases like "many companies", "studies show", "experts agree", "industry leaders", "researchers have found", "modern organizations" that hide behind anonymous plural authority instead of naming a specific source, number, or concrete subject. CRITICAL: Extract the exact verbatim phrase or clause from the text as ` +
      "`exactQuote`" +
      `.
3. "Robotic Symmetry / Contrast" (category: "orange"): Subtle AI structural padding, tricolon clichés, or overly symmetrical corporate phrasing not caught by simple rules. Extract the exact verbatim phrase/sentence from the text as ` +
      "`exactQuote`" +
      `.

For every item in ` +
      "`semanticIssues`" +
      `:
- ` +
      "`exactQuote`" +
      ` MUST be an exact, character-for-character substring present in the user's text so the editor can highlight and replace it in-place.
- Provide ` +
      "`reason`" +
      ` explaining concisely why this specific line sounds like an LLM.
- Provide ` +
      "`replacements`" +
      `: exactly 2 sharp, concrete, human-sounding rewrites that can directly replace ` +
      "`exactQuote`" +
      ` in-place.

PART 2 — CONTEXTUAL REWRITES FOR EXISTING FLAGS (` +
      "`contextualRewrites`" +
      `):
For the provided list of existing client-side flagged spans, generate 2 sharp, context-aware human replacements that fit smoothly into the surrounding sentence when ` +
      "`exactQuote`" +
      ` is replaced in-place.`;

    const prompt = `USER MANUSCRIPT:
"""
${text}
"""

EXISTING CLIENT-SIDE FLAGGED SPANS TO UPGRADE WITH CONTEXTUAL REWRITES:
${existingSummary}

Return JSON matching the schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        overallAssessment: {
          type: Type.STRING,
          description:
            "A 1-sentence editorial verdict on the manuscript's voice and AI tells.",
        },
        semanticIssues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              exactQuote: {
                type: Type.STRING,
                description:
                  "Exact verbatim substring from the manuscript (sentence or phrase).",
              },
              category: {
                type: Type.STRING,
                description:
                  "Color category code: 'red' for Hermetically Sealed Paragraphs, 'yellow' for Vague Authority Plurals, 'orange' for Symmetry Tells.",
              },
              subcategory: {
                type: Type.STRING,
                description:
                  "E.g. 'Hermetically Sealed Paragraph' or 'Vague Authority Plural'",
              },
              reason: {
                type: Type.STRING,
                description:
                  "Concise explanation of why this specific span sounds AI-generated.",
              },
              replacements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "2 punchy, concrete, human-sounding direct replacements for exactQuote.",
              },
            },
            required: [
              "exactQuote",
              "category",
              "subcategory",
              "reason",
              "replacements",
            ],
          },
        },
        contextualRewrites: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "The ID of the existing match from the prompt.",
              },
              replacements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "2 sharp, concrete, context-aware replacements that fit directly in place of the flagged span.",
              },
            },
            required: ["id", "replacements"],
          },
        },
      },
      required: ["overallAssessment", "semanticIssues", "contextualRewrites"],
    };

    const { response, modelUsed } = await generateWithFallback(ai, {
      modelsToTry: DEEP_SCAN_MODEL_CHAIN,
      contents: prompt,
      systemInstruction,
      responseSchema,
    });

    const rawText = response.text || "{}";
    const parsed = JSON.parse(rawText);
    return jsonResponse({
      ...parsed,
      modelUsed,
    });
  } catch (error: unknown) {
    console.error("Worker deep scan error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to run Deep AI Scan";
    return jsonResponse({ error: message }, 500);
  }
}

async function handleRewriteSpan(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: "GEMINI_API_KEY secret is not configured on this Worker." },
        500
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      matchedText?: string;
      category?: string;
      subcategory?: string;
      reason?: string;
      fullText?: string;
    };

    const { matchedText, category, subcategory, reason, fullText } = body;

    if (!matchedText || typeof matchedText !== "string") {
      return jsonResponse({ error: "matchedText is required." }, 400);
    }

    const ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `You are "Unbot", a sharp human prose editor. Given a flagged AI-sounding phrase or sentence and its surrounding manuscript context, generate 2 distinct, punchy, concrete, human-sounding replacements that can directly replace the flagged span in-place without breaking grammar.
- Option 1: Direct, plain-spoken, and concise.
- Option 2: Vivid, rhythmic, and concrete (or cuts fluff entirely if it's a participial tail or throat-clearing opener).
- Preserve any necessary surrounding punctuation if the original span starts with a comma or ends with a period.`;

    const prompt = `FULL MANUSCRIPT CONTEXT:
"""
${(fullText || "").slice(0, 3000)}
"""

FLAGGED SPAN TO REPLACE IN-PLACE:
"${matchedText}"

ISSUE TYPE: ${subcategory || category || "AI Pattern"}
DIAGNOSIS: ${reason || "Sounds like AI"}

Provide 2 direct drop-in replacements for "${matchedText}".`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        replacements: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "2 sharp, human-sounding direct replacements for the flagged span.",
        },
      },
      required: ["replacements"],
    };

    const { response, modelUsed } = await generateWithFallback(ai, {
      modelsToTry: REWRITE_SPAN_MODEL_CHAIN,
      contents: prompt,
      systemInstruction,
      responseSchema,
    });

    const rawText = response.text || "{}";
    const parsed = JSON.parse(rawText);
    return jsonResponse({
      ...parsed,
      modelUsed,
    });
  } catch (error: unknown) {
    console.error("Worker single span rewrite error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate rewrites";
    return jsonResponse({ error: message }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight for /api/* routes
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (url.pathname === "/api/deep-scan" && request.method === "POST") {
      return handleDeepScan(request, env);
    }

    if (url.pathname === "/api/rewrite-span" && request.method === "POST") {
      return handleRewriteSpan(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "API route not found" }, 404);
    }

    // Fallback to Cloudflare Workers Static Assets binding for SPA
    return env.ASSETS.fetch(request);
  },
};
