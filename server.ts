import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2mb" }));

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

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
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
        `[Unbot Fallback] Model "${modelName}" failed (${errMsg}). Trying next model in chain...`
      );
    }
  }

  throw lastError;
}

// POST /api/deep-scan
// Analyzes the full manuscript for:
// 1. Hermetically Sealed Paragraphs
// 2. Vague Authority Plurals
// 3. Contextual Rewrites for both semantic issues and existing client-side flags
app.post("/api/deep-scan", async (req, res) => {
  try {
    const { text, existingMatches } = req.body as {
      text?: string;
      existingMatches?: Array<{
        id: string;
        text: string;
        category: string;
        subcategory: string;
      }>;
    };

    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Text is required for Deep AI Scan." });
      return;
    }

    const ai = getGenAIClient();

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
    res.json({
      ...parsed,
      modelUsed,
    });
  } catch (error: unknown) {
    console.error("Deep scan error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to run Deep AI Scan";
    res.status(500).json({ error: message });
  }
});

// POST /api/rewrite-span
// Generates 2 contextual human replacements for a single highlighted span on click
app.post("/api/rewrite-span", async (req, res) => {
  try {
    const { matchedText, category, subcategory, reason, fullText } =
      req.body as {
        matchedText?: string;
        category?: string;
        subcategory?: string;
        reason?: string;
        fullText?: string;
      };

    if (!matchedText || typeof matchedText !== "string") {
      res.status(400).json({ error: "matchedText is required." });
      return;
    }

    const ai = getGenAIClient();

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
    res.json({
      ...parsed,
      modelUsed,
    });
  } catch (error: unknown) {
    console.error("Single span rewrite error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate rewrites";
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Unbot server listening on http://localhost:${PORT}`);
  });
}

startServer();
