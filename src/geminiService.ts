import { DeepScanResponse, IssueMatch } from "./types";

export async function runDeepScan(
  text: string,
  existingMatches: IssueMatch[]
): Promise<DeepScanResponse> {
  const response = await fetch("/api/deep-scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      existingMatches: existingMatches.map((m) => ({
        id: m.id,
        text: m.text,
        category: m.category,
        subcategory: m.subcategory,
      })),
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData.error || `Deep AI Scan failed (${response.status})`
    );
  }

  return response.json();
}

export async function rewriteSingleSpan(params: {
  matchedText: string;
  category: string;
  subcategory: string;
  reason: string;
  fullText: string;
}): Promise<string[]> {
  const response = await fetch("/api/rewrite-span", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Rewrite failed (${response.status})`);
  }

  const data = (await response.json()) as { replacements?: string[] };
  return data.replacements || [];
}
