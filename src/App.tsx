/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  Sparkles,
  FileText,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { SAMPLE_AI_TEXT, HUMAN_SAMPLE_TEXT } from "./SampleText";
import { analyzeDocument } from "./detectionEngine";
import { runDeepScan } from "./geminiService";
import { HighlightCategory, IssueMatch } from "./types";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  const [text, setText] = useState<string>(SAMPLE_AI_TEXT);
  const [history, setHistory] = useState<string[]>([]);
  const [mode, setMode] = useState<"write" | "edit">("edit");
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<HighlightCategory | null>(null);

  // Gemini Deep Scan state
  const [deepScanMatches, setDeepScanMatches] = useState<IssueMatch[]>([]);
  const [customReplacementMap, setCustomReplacementMap] = useState<
    Record<string, { replacements: string[]; modelUsed?: string }>
  >({});
  const [overallAssessment, setOverallAssessment] = useState<string | null>(
    null
  );
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Run real-time detection engine
  const rawAnalysis = useMemo(
    () => analyzeDocument(text, deepScanMatches),
    [text, deepScanMatches]
  );

  // Merge any Gemini contextual replacement upgrades into the matches
  const enrichedMatches = useMemo(() => {
    return rawAnalysis.matches.map((m) => {
      const customByKey = customReplacementMap[m.text];
      const customById = customReplacementMap[m.id];
      const override = customById || customByKey;
      if (override && override.replacements.length > 0) {
        return {
          ...m,
          replacements: override.replacements,
          modelUsed: override.modelUsed || m.modelUsed,
        };
      }
      return m;
    });
  }, [rawAnalysis.matches, customReplacementMap]);

  const analysis = useMemo(
    () => ({
      ...rawAnalysis,
      matches: enrichedMatches,
    }),
    [rawAnalysis, enrichedMatches]
  );

  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    setScanError(null);
  }, []);

  const handleApplyReplacement = useCallback(
    (match: IssueMatch, replacementText: string) => {
      setHistory((prev) => [...prev.slice(-19), text]);
      const before = text.slice(0, match.start);
      const after = text.slice(match.end);
      const nextText = before + replacementText + after;
      setText(nextText);
    },
    [text]
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previousText = prev[prev.length - 1];
      setText(previousText);
      return prev.slice(0, -1);
    });
  }, []);

  const handleUpdateMatchReplacements = useCallback(
    (matchId: string, newReplacements: string[], modelUsed?: string) => {
      if (modelUsed) {
        setLastModelUsed(modelUsed);
      }
      const target = enrichedMatches.find((m) => m.id === matchId);
      const entry = { replacements: newReplacements, modelUsed };
      setCustomReplacementMap((prev) => ({
        ...prev,
        [matchId]: entry,
        ...(target ? { [target.text]: entry } : {}),
      }));
    },
    [enrichedMatches]
  );

  const handleToggleCategoryFilter = useCallback(
    (category: HighlightCategory) => {
      setActiveCategoryFilter((prev) => (prev === category ? null : category));
      if (mode === "write") {
        setMode("edit");
      }
    },
    [mode]
  );

  const handleLoadSampleAI = () => {
    setHistory((prev) => [...prev.slice(-19), text]);
    setText(SAMPLE_AI_TEXT);
    setDeepScanMatches([]);
    setOverallAssessment(null);
    setScanError(null);
    setActiveCategoryFilter(null);
    setMode("edit");
  };

  const handleLoadHumanSample = () => {
    setHistory((prev) => [...prev.slice(-19), text]);
    setText(HUMAN_SAMPLE_TEXT);
    setDeepScanMatches([]);
    setOverallAssessment(null);
    setScanError(null);
    setActiveCategoryFilter(null);
    setMode("edit");
  };

  const handleClear = () => {
    if (!text) return;
    setHistory((prev) => [...prev.slice(-19), text]);
    setText("");
    setDeepScanMatches([]);
    setOverallAssessment(null);
    setScanError(null);
    setActiveCategoryFilter(null);
  };

  const handleCopyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handleDeepScan = async () => {
    if (!text.trim() || isScanning) return;
    setIsScanning(true);
    setScanError(null);
    setMode("edit");

    try {
      const result = await runDeepScan(text, analysis.matches);

      if (result.modelUsed) {
        setLastModelUsed(result.modelUsed);
      }

      if (result.overallAssessment) {
        setOverallAssessment(result.overallAssessment);
      }

      // Convert semanticIssues into IssueMatch objects
      const newDeepMatches: IssueMatch[] = [];
      result.semanticIssues?.forEach((issue, idx) => {
        const quote = (issue.exactQuote || "").trim();
        if (!quote) return;
        const startIdx = text.indexOf(quote);
        if (startIdx === -1) return;

        const validCat: HighlightCategory =
          issue.category === "red" ||
          issue.category === "purple" ||
          issue.category === "yellow" ||
          issue.category === "blue" ||
          issue.category === "orange"
            ? issue.category
            : issue.subcategory.toLowerCase().includes("plural") ||
              issue.subcategory.toLowerCase().includes("authority")
            ? "yellow"
            : "red";

        newDeepMatches.push({
          id: `gemini-deep-${Date.now()}-${idx}`,
          category: validCat,
          subcategory: issue.subcategory || "Semantic AI Tell",
          start: startIdx,
          end: startIdx + quote.length,
          text: quote,
          reason: issue.reason,
          replacements: issue.replacements || [],
          isDeepScan: true,
          modelUsed: result.modelUsed,
        });
      });

      setDeepScanMatches(newDeepMatches);

      // Store contextual rewrites for existing client-side matches
      if (result.contextualRewrites && result.contextualRewrites.length > 0) {
        setCustomReplacementMap((prev) => {
          const next = { ...prev };
          for (const cr of result.contextualRewrites) {
            if (cr.id && cr.replacements && cr.replacements.length > 0) {
              const entry = {
                replacements: cr.replacements,
                modelUsed: result.modelUsed,
              };
              next[cr.id] = entry;
              const matchedObj = analysis.matches.find((m) => m.id === cr.id);
              if (matchedObj) {
                next[matchedObj.text] = entry;
              }
            }
          }
          return next;
        });
      }
    } catch (err: unknown) {
      setScanError(
        err instanceof Error
          ? err.message
          : "Deep AI Scan encountered an error."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const deepScanCount = useMemo(
    () => analysis.matches.filter((m) => m.isDeepScan).length,
    [analysis.matches]
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* TOP TOOLBAR */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-[#E4DEC9] bg-[#F6F2EA]/95 px-6 py-3 backdrop-blur-xs">
        {/* Zone 1: Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveCategoryFilter(null);
          }}
          className="font-editorial text-xl font-bold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0"
        >
          Unbot
        </a>

        {/* Zone 2: Document & Preset Controls */}
        <nav className="flex flex-wrap items-center gap-5 text-xs font-medium text-[#57534E]">
          {/* Write / Edit Segmented Mode Toggle */}
          <div
            role="group"
            aria-label="Editor Mode"
            className="inline-flex items-center rounded-lg border border-[#DCD5C7] bg-[#EDE8DD] p-0.5"
          >
            <button
              type="button"
              onClick={() => setMode("write")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === "write"
                  ? "bg-white text-[#1C1917] shadow-2xs"
                  : "text-[#57534E] hover:text-[#1C1917]"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === "edit"
                  ? "bg-white text-[#1C1917] shadow-2xs"
                  : "text-[#57534E] hover:text-[#1C1917]"
              }`}
            >
              Edit
            </button>
          </div>

          <button
            type="button"
            onClick={handleLoadSampleAI}
            className="inline-flex items-center gap-1.5 hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Load Sample AI Text</span>
          </button>

          <button
            type="button"
            onClick={handleLoadHumanSample}
            className="hidden sm:inline-flex items-center gap-1.5 hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Human Benchmark</span>
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            disabled={!text.trim()}
            className="hidden md:inline-flex items-center gap-1.5 hover:text-[#1C1917] hover:underline underline-offset-4 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#15803D]" />
                <span className="text-[#15803D]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={!text.trim()}
            className="inline-flex items-center gap-1.5 hover:text-[#B91C1C] hover:underline underline-offset-4 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action — Deep AI Scan (Gemini) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDeepScan}
            disabled={isScanning || !text.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1C1917] px-4 py-2 text-xs font-semibold text-[#FBF9F5] hover:bg-[#332E2A] disabled:opacity-50 transition-colors shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D8B4FE]" />
                <span>Scanning with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-[#D8B4FE]" />
                <span>Deep AI Scan (Gemini)</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Error Toast if Deep Scan fails */}
      {scanError && (
        <div className="border-b border-[#FCA5A5] bg-[#FEF2F2] px-6 py-2.5 text-xs text-[#991B1B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{scanError}</span>
          </div>
          <button
            onClick={() => setScanError(null)}
            className="font-semibold underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN SPLIT WORKSPACE (70% Left Editor / 30% Right Sidebar) */}
      <main className="flex flex-1 flex-col lg:flex-row">
        <Editor
          text={text}
          onChangeText={handleTextChange}
          mode={mode}
          onChangeMode={setMode}
          matches={analysis.matches}
          activeCategoryFilter={activeCategoryFilter}
          onClearFilter={() => setActiveCategoryFilter(null)}
          onApplyReplacement={handleApplyReplacement}
          onUpdateMatchReplacements={handleUpdateMatchReplacements}
          canUndo={history.length > 0}
          onUndo={handleUndo}
          overallAssessment={overallAssessment}
          lastModelUsed={lastModelUsed}
        />

        <Sidebar
          analysis={analysis}
          activeCategoryFilter={activeCategoryFilter}
          onToggleCategoryFilter={handleToggleCategoryFilter}
          deepScanCount={deepScanCount}
        />
      </main>
    </div>
  );
}
