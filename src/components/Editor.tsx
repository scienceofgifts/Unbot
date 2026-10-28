import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Sparkles,
  Check,
  Wand2,
  Trash2,
  X,
  Edit3,
  Eye,
  RotateCcw,
  Loader2,
  ArrowRight,
  Columns,
} from "lucide-react";
import { HighlightCategory, IssueMatch } from "../types";
import { CATEGORY_META } from "../detectionEngine";
import { rewriteSingleSpan } from "../geminiService";

interface EditorProps {
  text: string;
  onChangeText: (newText: string) => void;
  mode: "write" | "edit";
  onChangeMode: (mode: "write" | "edit") => void;
  matches: IssueMatch[];
  activeCategoryFilter: HighlightCategory | null;
  onClearFilter: () => void;
  onApplyReplacement: (match: IssueMatch, replacementText: string) => void;
  onUpdateMatchReplacements: (matchId: string, newReplacements: string[]) => void;
  canUndo: boolean;
  onUndo: () => void;
  overallAssessment?: string | null;
}

interface TextSegment {
  start: number;
  end: number;
  text: string;
  activeMatches: IssueMatch[];
  primaryMatch?: IssueMatch;
}

export const Editor: React.FC<EditorProps> = ({
  text,
  onChangeText,
  mode,
  onChangeMode,
  matches,
  activeCategoryFilter,
  onClearFilter,
  onApplyReplacement,
  onUpdateMatchReplacements,
  canUndo,
  onUndo,
  overallAssessment,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    placement: "above" | "below";
  } | null>(null);
  const [isRewritingSpan, setIsRewritingSpan] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [splitLiveEdit, setSplitLiveEdit] = useState(false);
  const [recentlyReplacedRange, setRecentlyReplacedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const filteredMatches = useMemo(() => {
    if (!activeCategoryFilter) return matches;
    return matches.filter((m) => m.category === activeCategoryFilter);
  }, [matches, activeCategoryFilter]);

  const activeMatchId = selectedMatchId || hoveredMatchId;
  const activeMatch = useMemo(
    () => matches.find((m) => m.id === activeMatchId) || null,
    [matches, activeMatchId]
  );

  // Build non-overlapping elementary segments so nested/overlapping matches render cleanly
  const segments = useMemo<TextSegment[]>(() => {
    if (!text) return [];
    if (filteredMatches.length === 0) {
      return [{ start: 0, end: text.length, text, activeMatches: [] }];
    }

    const boundaries = new Set<number>([0, text.length]);
    for (const m of filteredMatches) {
      const s = Math.max(0, Math.min(text.length, m.start));
      const e = Math.max(0, Math.min(text.length, m.end));
      if (e > s) {
        boundaries.add(s);
        boundaries.add(e);
      }
    }

    const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
    const result: TextSegment[] = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const segStart = sortedPoints[i];
      const segEnd = sortedPoints[i + 1];
      if (segEnd <= segStart) continue;

      const covering = filteredMatches
        .filter((m) => m.start <= segStart && m.end >= segEnd)
        .sort((a, b) => {
          // Prioritize Deep Scan or shorter/more specific spans first so inner words are clickable
          const lenA = a.end - a.start;
          const lenB = b.end - b.start;
          return lenA - lenB;
        });

      result.push({
        start: segStart,
        end: segEnd,
        text: text.slice(segStart, segEnd),
        activeMatches: covering,
        primaryMatch: covering[0],
      });
    }

    return result;
  }, [text, filteredMatches]);

  // Position the popover relative to the highlighted span inside canvasContainerRef
  const updatePopoverPosition = (targetEl: HTMLElement) => {
    if (!canvasContainerRef.current) return;
    const containerRect = canvasContainerRef.current.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const relativeTop =
      targetRect.top - containerRect.top + canvasContainerRef.current.scrollTop;
    const relativeBottom =
      targetRect.bottom -
      containerRect.top +
      canvasContainerRef.current.scrollTop;
    const relativeLeft = targetRect.left - containerRect.left;

    const popoverWidth = 380;
    const maxLeft = Math.max(16, containerRect.width - popoverWidth - 20);
    const clampedLeft = Math.max(16, Math.min(relativeLeft, maxLeft));

    // Place below by default unless near bottom of viewport
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const placement = spaceBelow < 270 && targetRect.top > 280 ? "above" : "below";

    setPopoverCoords({
      top: placement === "below" ? relativeBottom + 10 : relativeTop - 10,
      left: clampedLeft,
      placement,
    });
  };

  const handleSpanClick = (
    e: React.MouseEvent<HTMLSpanElement>,
    match: IssueMatch
  ) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setRewriteError(null);
    setSelectedMatchId(match.id);
    setHoveredMatchId(null);
    updatePopoverPosition(e.currentTarget);
  };

  const handleSpanMouseEnter = (
    e: React.MouseEvent<HTMLSpanElement>,
    match: IssueMatch
  ) => {
    if (selectedMatchId) return; // Don't override a pinned click popover
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const targetEl = e.currentTarget;
    setRewriteError(null);
    setHoveredMatchId(match.id);
    updatePopoverPosition(targetEl);
  };

  const handleSpanMouseLeave = () => {
    if (selectedMatchId) return;
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredMatchId(null);
    }, 220);
  };

  const handlePopoverMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handlePopoverMouseLeave = () => {
    if (!selectedMatchId) {
      setHoveredMatchId(null);
    }
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setSelectedMatchId(null);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  const handleChooseReplacement = (match: IssueMatch, replacement: string) => {
    onApplyReplacement(match, replacement);
    setRecentlyReplacedRange({
      start: match.start,
      end: match.start + replacement.length,
    });
    setSelectedMatchId(null);
    setHoveredMatchId(null);
    window.setTimeout(() => setRecentlyReplacedRange(null), 1200);
  };

  const handleGeminiSingleRewrite = async (match: IssueMatch) => {
    setIsRewritingSpan(true);
    setRewriteError(null);
    try {
      const newOptions = await rewriteSingleSpan({
        matchedText: match.text,
        category: match.category,
        subcategory: match.subcategory,
        reason: match.reason,
        fullText: text,
      });
      if (newOptions.length > 0) {
        onUpdateMatchReplacements(match.id, newOptions);
      }
    } catch (err: unknown) {
      setRewriteError(
        err instanceof Error ? err.message : "Could not generate rewrites."
      );
    } finally {
      setIsRewritingSpan(false);
    }
  };

  return (
    <div
      ref={canvasContainerRef}
      className="relative flex-1 overflow-y-auto px-6 py-8 md:px-14 lg:px-20"
    >
      <div className="mx-auto max-w-[780px]">
        {/* Contextual Banner Bar above the manuscript */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E0D4] pb-3.5 text-xs text-[#6B635B]">
          <div className="flex items-center gap-3">
            {mode === "edit" ? (
              <span className="flex items-center gap-1.5 font-medium text-[#292524]">
                <Eye className="h-3.5 w-3.5 text-[#78716C]" />
                <span>
                  Edit Mode: Hover or click any highlight to inspect AI tells &amp; apply 1-click rewrites
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-[#292524]">
                <Edit3 className="h-3.5 w-3.5 text-[#78716C]" />
                <span>
                  Write Mode: Distraction-free drafting (all AI highlights hidden)
                </span>
              </span>
            )}

            {activeCategoryFilter && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  onClick={onClearFilter}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1C1917] underline decoration-[#A8A29E] underline-offset-4 hover:decoration-[#1C1917] whitespace-nowrap shrink-0"
                >
                  <span>
                    Filtering: {CATEGORY_META[activeCategoryFilter].shortLabel}
                  </span>
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canUndo && (
              <button
                onClick={onUndo}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DCD5C7] bg-white px-2.5 py-1 text-xs font-medium text-[#292524] hover:bg-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
                title="Undo last rewrite"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Undo Rewrite</span>
              </button>
            )}

            {mode === "edit" && (
              <button
                onClick={() => setSplitLiveEdit((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  splitLiveEdit
                    ? "border-[#1C1917] bg-[#1C1917] text-white"
                    : "border-[#DCD5C7] bg-white text-[#292524] hover:bg-[#F3EFE6]"
                }`}
              >
                <Columns className="h-3 w-3" />
                <span>{splitLiveEdit ? "Hide Live Editor" : "Type / Paste Live"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Gemini Deep Scan Verdict Banner if available */}
        {overallAssessment && mode === "edit" && (
          <div className="mb-6 rounded-lg border border-[#DCD5C7] bg-[#F4F0E8] px-4 py-3 text-sm text-[#292524]">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#6D28D9]" />
              <div>
                <span className="font-semibold text-[#1C1917]">
                  Gemini Deep Scan Verdict:{" "}
                </span>
                <span className="text-[#44403C]">{overallAssessment}</span>
              </div>
            </div>
          </div>
        )}

        {/* Optional Live Input / Paste Drawer while in Edit Mode */}
        {mode === "edit" && splitLiveEdit && (
          <div className="mb-8 rounded-lg border border-[#D6CFC1] bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between text-xs text-[#6B635B]">
              <span className="font-semibold text-[#292524]">
                Live Draft Input (type or paste here to watch highlights update in real time)
              </span>
              <button
                onClick={() => setSplitLiveEdit(false)}
                className="text-[#78716C] hover:text-[#1C1917]"
              >
                Done typing
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              placeholder="Type or paste your draft here..."
              rows={6}
              className="font-editorial w-full resize-y rounded border border-[#E6E0D4] bg-[#FBF9F5] p-3 text-base leading-relaxed text-[#1C1917] focus:border-[#1C1917] focus:outline-none"
            />
          </div>
        )}

        {/* MAIN MANUSCRIPT SURFACE */}
        {mode === "write" ? (
          <div className="min-h-[620px]">
            <textarea
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              placeholder="Start writing or paste your text here..."
              className="font-editorial min-h-[640px] w-full resize-none border-0 bg-transparent text-[19px] leading-[1.85] text-[#1C1917] placeholder-[#A8A29E] focus:outline-none"
              autoFocus
            />
          </div>
        ) : text.trim().length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-[#D6CFC1] bg-[#F6F2EA]/60 p-10 text-center">
            <p className="font-editorial mb-2 text-lg text-[#44403C]">
              Your manuscript canvas is empty.
            </p>
            <p className="mb-5 max-w-md text-sm text-[#78716C]">
              Switch to Write Mode to paste or type a draft, or load the sample AI article in the top toolbar to test real-time detection.
            </p>
            <button
              onClick={() => onChangeMode("write")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1C1917] px-4 py-2 text-xs font-medium text-white hover:bg-[#292524] transition-colors whitespace-nowrap shrink-0"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Start Writing</span>
            </button>
          </div>
        ) : (
          <article
            onDoubleClick={() => setSplitLiveEdit(true)}
            className="font-editorial whitespace-pre-wrap text-[19px] leading-[1.9] text-[#1C1917] tracking-[-0.005em]"
          >
            {segments.map((seg, idx) => {
              const primary = seg.primaryMatch;
              const isRecentlyReplaced =
                recentlyReplacedRange &&
                seg.start >= recentlyReplacedRange.start &&
                seg.end <= recentlyReplacedRange.end;

              if (!primary) {
                return (
                  <span
                    key={`${seg.start}-${seg.end}-${idx}`}
                    className={
                      isRecentlyReplaced
                        ? "bg-emerald-200/80 transition-colors duration-700 rounded px-0.5"
                        : undefined
                    }
                  >
                    {seg.text}
                  </span>
                );
              }

              const meta = CATEGORY_META[primary.category];
              const isSelected = activeMatchId === primary.id;
              // Check if there is also a broader enclosing match (e.g. a Blue cadence sentence around a Purple word)
              const secondaryMatch =
                seg.activeMatches.length > 1 ? seg.activeMatches[1] : null;
              const secondaryBorder = secondaryMatch
                ? secondaryMatch.category === "blue"
                  ? "border-b-2 border-[#2563EB]"
                  : secondaryMatch.category === "orange"
                  ? "border-b-2 border-[#EA580C]"
                  : "border-b-2 border-[#C93B37]"
                : "";

              return (
                <span
                  key={`${seg.start}-${seg.end}-${idx}`}
                  onClick={(e) => handleSpanClick(e, primary)}
                  onMouseEnter={(e) => handleSpanMouseEnter(e, primary)}
                  onMouseLeave={handleSpanMouseLeave}
                  className={`cursor-pointer rounded-[3px] px-[2px] py-[2px] transition-colors duration-150 ${
                    isSelected ? meta.bgActiveClass : meta.bgClass
                  } ${secondaryBorder} ${
                    primary.isDeepScan ? "underline decoration-dotted underline-offset-4" : ""
                  }`}
                >
                  {seg.text}
                </span>
              );
            })}
          </article>
        )}

        {/* Subtle helper note at bottom of manuscript in Edit mode */}
        {mode === "edit" && text.trim().length > 0 && (
          <div className="mt-12 border-t border-[#E6E0D4] pt-4 text-xs text-[#78716C] flex items-center justify-between">
            <span>
              Tip: Double-click anywhere on the manuscript or click &ldquo;Type / Paste Live&rdquo; to edit text directly.
            </span>
            <span>{matches.length} total AI tells detected</span>
          </div>
        )}
      </div>

      {/* FLOATING DIAGNOSTIC POPOVER CARD */}
      {mode === "edit" && activeMatch && popoverCoords && (
        <div
          ref={popoverRef}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          style={{
            top:
              popoverCoords.placement === "below"
                ? `${popoverCoords.top}px`
                : undefined,
            bottom:
              popoverCoords.placement === "above"
                ? `calc(100% - ${popoverCoords.top}px)`
                : undefined,
            left: `${popoverCoords.left}px`,
          }}
          className="absolute z-40 w-[370px] max-w-[calc(100vw-32px)] rounded-xl border border-[#D6CFC1] bg-white p-4 shadow-xl transition-opacity duration-150"
        >
          {/* Popover Header */}
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{
                  backgroundColor: CATEGORY_META[activeMatch.category].dotColor,
                }}
              />
              <span className="font-semibold text-[#1C1917]">
                {activeMatch.subcategory}
              </span>
              {activeMatch.isDeepScan && (
                <>
                  <span aria-hidden="true" className="text-[#A8A29E]">
                    ·
                  </span>
                  <span className="font-medium text-[#6D28D9]">
                    Gemini Deep Scan
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedMatchId(null);
                setHoveredMatchId(null);
              }}
              className="rounded p-0.5 text-[#78716C] hover:bg-[#F3EFE6] hover:text-[#1C1917]"
              aria-label="Close diagnostic card"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Flagged Quote Preview */}
          <div className="mb-2.5 rounded-md bg-[#FBF9F5] px-2.5 py-1.5 font-editorial text-xs italic text-[#44403C] border border-[#EDE8DF] line-clamp-2">
            &ldquo;{activeMatch.text}&rdquo;
          </div>

          {/* Explanation */}
          <p className="mb-3.5 text-xs leading-relaxed text-[#44403C]">
            {activeMatch.reason}
          </p>

          {/* 1-Click Human Replacements */}
          {activeMatch.replacements && activeMatch.replacements.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-[#78716C]">
                1-Click Human Replacements:
              </div>
              {activeMatch.replacements.map((rep, idx) => (
                <button
                  key={`${activeMatch.id}-rep-${idx}`}
                  onClick={() => handleChooseReplacement(activeMatch, rep)}
                  className="group flex w-full items-center justify-between gap-2 rounded-lg border border-[#E4DEC9] bg-[#FBF9F5] px-3 py-2 text-left text-xs font-medium text-[#1C1917] hover:border-[#1C1917] hover:bg-[#1C1917] hover:text-white transition-colors"
                >
                  <span className="font-editorial leading-snug">
                    {rep === "" ? "(Cut phrase entirely)" : `“${rep}”`}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] opacity-70 group-hover:opacity-100">
                    <span>Apply</span>
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          )}

          {rewriteError && (
            <p className="mb-2.5 text-xs text-[#B91C1C]">{rewriteError}</p>
          )}

          {/* Bottom Actions: Rewrite with Gemini & Cut */}
          <div className="flex items-center justify-between gap-2 border-t border-[#EDE8DF] pt-2.5">
            <button
              onClick={() => handleGeminiSingleRewrite(activeMatch)}
              disabled={isRewritingSpan}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#F3EEFC] px-2.5 py-1.5 text-xs font-semibold text-[#5B21B6] hover:bg-[#E7DDF9] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {isRewritingSpan ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Writing human options...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Rewrite with Gemini</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleChooseReplacement(activeMatch, "")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[#78716C] hover:bg-[#FEE2E2] hover:text-[#991B1B] transition-colors whitespace-nowrap shrink-0"
              title="Delete this flagged span from the manuscript"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Cut</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
