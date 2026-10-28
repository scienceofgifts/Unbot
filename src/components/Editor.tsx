import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
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
  Cpu,
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
  onUpdateMatchReplacements: (
    matchId: string,
    newReplacements: string[],
    modelUsed?: string
  ) => void;
  canUndo: boolean;
  onUndo: () => void;
  overallAssessment?: string | null;
  lastModelUsed?: string | null;
}

interface TextSegment {
  start: number;
  end: number;
  text: string;
  activeMatches: IssueMatch[];
  primaryMatch?: IssueMatch;
}

interface ViewportSnapshot {
  windowScrollY: number;
  windowScrollX: number;
  containerScrollTop: number;
  caretPos: number | null;
  shouldFocus: boolean;
}

export const Editor: React.FC<EditorProps> = ({
  text,
  onChangeText,
  mode,
  matches,
  activeCategoryFilter,
  onClearFilter,
  onApplyReplacement,
  onUpdateMatchReplacements,
  canUndo,
  onUndo,
  overallAssessment,
  lastModelUsed,
}) => {
  // Popover opens ONLY on explicit click inside a highlight (never on hover)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  // Subtle visual-only hover highlight state (does NOT open or move the popover)
  const [hoveredVisualMatchId, setHoveredVisualMatchId] = useState<
    string | null
  >(null);

  const [isManualInputFocused, setIsManualInputFocused] =
    useState<boolean>(false);
  const [manualEditValue, setManualEditValue] = useState<string>("");

  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    placement: "above" | "below";
  } | null>(null);

  const [isRewritingSpan, setIsRewritingSpan] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [recentlyReplacedRange, setRecentlyReplacedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  // Ref storing scroll & cursor state across text updates to prevent viewport jumps
  const pendingViewportRestoreRef = useRef<ViewportSnapshot | null>(null);

  const captureViewportSnapshot = useCallback(
    (caretPos: number | null = null, shouldFocus = false) => {
      pendingViewportRestoreRef.current = {
        windowScrollY:
          window.scrollY || document.documentElement.scrollTop || 0,
        windowScrollX:
          window.scrollX || document.documentElement.scrollLeft || 0,
        containerScrollTop: canvasContainerRef.current
          ? canvasContainerRef.current.scrollTop
          : 0,
        caretPos,
        shouldFocus,
      };
    },
    []
  );

  // Synchronously restore scroll position and cursor BEFORE browser paint
  useLayoutEffect(() => {
    const snap = pendingViewportRestoreRef.current;
    if (!snap) return;

    if (textareaRef.current) {
      if (snap.shouldFocus) {
        textareaRef.current.focus({ preventScroll: true });
      }
      if (snap.caretPos !== null) {
        const clampedCaret = Math.max(0, Math.min(text.length, snap.caretPos));
        textareaRef.current.setSelectionRange(clampedCaret, clampedCaret);
      }
      textareaRef.current.scrollTop = 0;
    }

    if (canvasContainerRef.current) {
      canvasContainerRef.current.scrollTop = snap.containerScrollTop;
    }

    window.scrollTo(snap.windowScrollX, snap.windowScrollY);
    pendingViewportRestoreRef.current = null;
  }, [text]);

  const filteredMatches = useMemo(() => {
    if (!activeCategoryFilter) return matches;
    return matches.filter((m) => m.category === activeCategoryFilter);
  }, [matches, activeCategoryFilter]);

  const activeMatch = useMemo(
    () => filteredMatches.find((m) => m.id === selectedMatchId) || null,
    [filteredMatches, selectedMatchId]
  );

  // Sync manual edit input box with activeMatch.text unless user is actively typing in the manual box
  useEffect(() => {
    if (activeMatch && !isManualInputFocused) {
      setManualEditValue(activeMatch.text);
      setRewriteError(null);
    }
  }, [activeMatch?.id, activeMatch?.text, isManualInputFocused]);

  // Build non-overlapping elementary segments (including recentlyReplacedRange boundaries for the green flash)
  const segments = useMemo<TextSegment[]>(() => {
    if (!text) return [];

    const boundaries = new Set<number>([0, text.length]);

    if (recentlyReplacedRange) {
      const rs = Math.max(0, Math.min(text.length, recentlyReplacedRange.start));
      const re = Math.max(0, Math.min(text.length, recentlyReplacedRange.end));
      if (re > rs) {
        boundaries.add(rs);
        boundaries.add(re);
      }
    }

    if (mode === "edit") {
      for (const m of filteredMatches) {
        const s = Math.max(0, Math.min(text.length, m.start));
        const e = Math.max(0, Math.min(text.length, m.end));
        if (e > s) {
          boundaries.add(s);
          boundaries.add(e);
        }
      }
    }

    const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
    const result: TextSegment[] = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const segStart = sortedPoints[i];
      const segEnd = sortedPoints[i + 1];
      if (segEnd <= segStart) continue;

      const covering =
        mode === "edit"
          ? filteredMatches
              .filter((m) => m.start <= segStart && m.end >= segEnd)
              .sort((a, b) => a.end - a.start - (b.end - b.start))
          : [];

      result.push({
        start: segStart,
        end: segEnd,
        text: text.slice(segStart, segEnd),
        activeMatches: covering,
        primaryMatch: covering[0],
      });
    }

    return result;
  }, [text, mode, filteredMatches, recentlyReplacedRange]);

  // Compute non-blocking popover coordinates above or below the clicked highlight span
  const updatePopoverPositionForMatch = useCallback((matchId: string) => {
    if (!canvasContainerRef.current || !backdropRef.current) return;
    const nodes = backdropRef.current.querySelectorAll<HTMLElement>(
      `[data-match-id="${matchId}"]`
    );
    if (nodes.length === 0) return;

    const containerRect = canvasContainerRef.current.getBoundingClientRect();
    let minTop = Infinity;
    let maxBottom = -Infinity;
    let minLeft = Infinity;

    nodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.top < minTop) minTop = r.top;
      if (r.bottom > maxBottom) maxBottom = r.bottom;
      if (r.left < minLeft) minLeft = r.left;
    });

    if (minTop === Infinity) return;

    const scrollTop = canvasContainerRef.current.scrollTop;
    const relativeTop = minTop - containerRect.top + scrollTop;
    const relativeBottom = maxBottom - containerRect.top + scrollTop;
    const relativeLeft = minLeft - containerRect.left;

    const popoverWidth = 390;
    const maxLeft = Math.max(16, containerRect.width - popoverWidth - 24);
    const clampedLeft = Math.max(16, Math.min(relativeLeft, maxLeft));

    const spaceBelow = window.innerHeight - maxBottom;
    const placement = spaceBelow < 320 && minTop > 310 ? "above" : "below";

    setPopoverCoords({
      top: placement === "below" ? relativeBottom + 12 : relativeTop - 12,
      left: clampedLeft,
      placement,
    });
  }, []);

  useEffect(() => {
    if (selectedMatchId && mode === "edit") {
      updatePopoverPositionForMatch(selectedMatchId);
    }
  }, [selectedMatchId, text, mode, updatePopoverPositionForMatch]);

  // Find the most specific highlight span containing a given character offset
  const findMatchAtCaret = useCallback(
    (caret: number): IssueMatch | null => {
      const matchesAtCaret = filteredMatches
        .filter((m) => caret >= m.start && caret <= m.end)
        .sort((a, b) => a.end - a.start - (b.end - b.start));
      return matchesAtCaret[0] || null;
    },
    [filteredMatches]
  );

  // Open popover ONLY when the user clicks inside a highlighted span
  const handleTextareaClick = useCallback(() => {
    if (mode !== "edit" || !textareaRef.current) {
      setSelectedMatchId(null);
      return;
    }
    const caret = textareaRef.current.selectionStart ?? 0;
    const found = findMatchAtCaret(caret);
    setSelectedMatchId(found ? found.id : null);
  }, [mode, findMatchAtCaret]);

  // If the popover is currently open and the user moves their typing cursor into an unhighlighted area, close it
  const handleCursorMoveOrKeyUp = useCallback(() => {
    if (mode !== "edit" || !textareaRef.current) {
      setSelectedMatchId(null);
      return;
    }
    const caret = textareaRef.current.selectionStart ?? 0;
    const found = findMatchAtCaret(caret);
    if (!found) {
      setSelectedMatchId(null);
    } else if (selectedMatchId && found.id !== selectedMatchId) {
      setSelectedMatchId(found.id);
    }
  }, [mode, findMatchAtCaret, selectedMatchId]);

  // Subtle visual-only hover feedback (brightness/border change on the highlight span; NEVER opens a popup)
  const handleVisualHoverMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "edit" || !backdropRef.current) return;
    const { clientX, clientY } = e;
    const spanNodes =
      backdropRef.current.querySelectorAll<HTMLElement>("[data-match-id]");

    let hitId: string | null = null;
    for (let i = 0; i < spanNodes.length; i++) {
      const node = spanNodes[i];
      const rects = node.getClientRects();
      for (let rIdx = 0; rIdx < rects.length; rIdx++) {
        const rect = rects[rIdx];
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          hitId = node.getAttribute("data-match-id");
          break;
        }
      }
      if (hitId) break;
    }

    if (hoveredVisualMatchId !== hitId) {
      setHoveredVisualMatchId(hitId);
    }
  };

  const handleDismissPopover = useCallback(() => {
    setSelectedMatchId(null);
    setIsManualInputFocused(false);
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  // Close popover when clicking anywhere outside the editor and outside the popover
  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (!selectedMatchId) return;
      const target = e.target as Node;
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }
      if (textareaRef.current && textareaRef.current.contains(target)) {
        return;
      }
      setSelectedMatchId(null);
      setIsManualInputFocused(false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () =>
      document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [selectedMatchId]);

  // Close popover when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedMatchId) {
        e.preventDefault();
        handleDismissPopover();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMatchId, handleDismissPopover]);

  const handleChooseReplacement = (match: IssueMatch, replacement: string) => {
    const nextCaretPos = match.start + replacement.length;

    // 1. Snapshot scroll positions and desired cursor position BEFORE state change
    captureViewportSnapshot(nextCaretPos, true);

    // 2. Trigger brief 1.2s soft-green highlight flash on the replaced range
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    if (replacement.length > 0) {
      setRecentlyReplacedRange({
        start: match.start,
        end: nextCaretPos,
      });
      flashTimeoutRef.current = window.setTimeout(() => {
        setRecentlyReplacedRange(null);
        flashTimeoutRef.current = null;
      }, 1200);
    } else {
      const flashStart = Math.max(0, match.start - 1);
      const flashEnd = Math.min(
        text.length - (match.end - match.start),
        match.start + 1
      );
      if (flashEnd > flashStart) {
        setRecentlyReplacedRange({ start: flashStart, end: flashEnd });
        flashTimeoutRef.current = window.setTimeout(() => {
          setRecentlyReplacedRange(null);
          flashTimeoutRef.current = null;
        }, 1200);
      }
    }

    // 3. Close popover and apply replacement
    setSelectedMatchId(null);
    setIsManualInputFocused(false);
    onApplyReplacement(match, replacement);
  };

  const handleApplyManualEdit = () => {
    if (!activeMatch) return;
    handleChooseReplacement(activeMatch, manualEditValue);
  };

  const handleUndoClick = () => {
    const currentCaret = textareaRef.current?.selectionStart ?? null;
    captureViewportSnapshot(currentCaret, true);
    setSelectedMatchId(null);
    onUndo();
  };

  const handleGeminiSingleRewrite = async (match: IssueMatch) => {
    setIsRewritingSpan(true);
    setRewriteError(null);
    try {
      const { replacements: newOptions, modelUsed } = await rewriteSingleSpan({
        matchedText: match.text,
        category: match.category,
        subcategory: match.subcategory,
        reason: match.reason,
        fullText: text,
      });
      if (newOptions.length > 0) {
        onUpdateMatchReplacements(match.id, newOptions, modelUsed);
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
                  Edit Mode: Type anywhere freely, or click a highlighted phrase to open AI rewrite tools
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
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
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

          <div className="flex items-center gap-2.5">
            {lastModelUsed && (
              <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#5B21B6]">
                <Cpu className="h-3 w-3" />
                <span>Model: {lastModelUsed}</span>
              </span>
            )}

            {canUndo && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUndoClick}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DCD5C7] bg-white px-2.5 py-1 text-xs font-medium text-[#292524] hover:bg-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
                title="Undo last rewrite"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Undo Rewrite</span>
              </button>
            )}
          </div>
        </div>

        {/* Gemini Deep Scan Verdict Banner if available */}
        {overallAssessment && mode === "edit" && (
          <div className="mb-6 rounded-lg border border-[#DCD5C7] bg-[#F4F0E8] px-4 py-3 text-sm text-[#292524]">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 flex-1">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#6D28D9]" />
                <div>
                  <span className="font-semibold text-[#1C1917]">
                    Gemini Deep Scan Verdict:{" "}
                  </span>
                  <span className="text-[#44403C]">{overallAssessment}</span>
                </div>
              </div>
              {lastModelUsed && (
                <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#6D28D9]">
                  {lastModelUsed}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ALWAYS-EDITABLE SYNCHRONIZED OVERLAY CANVAS */}
        <div
          onMouseMove={handleVisualHoverMove}
          onMouseLeave={() => setHoveredVisualMatchId(null)}
          className="relative grid grid-cols-1 grid-rows-1 min-h-[620px] w-full"
        >
          {/* Layer 1: Synchronized Highlight Backdrop */}
          <div
            ref={backdropRef}
            aria-hidden="true"
            className="pointer-events-none col-start-1 row-start-1 min-h-[620px] w-full font-editorial whitespace-pre-wrap break-words text-[19px] leading-[1.9] tracking-[-0.005em] text-transparent select-none"
          >
            {segments.map((seg, idx) => {
              const primary = seg.primaryMatch;
              const isRecentlyReplaced =
                recentlyReplacedRange !== null &&
                seg.start >= recentlyReplacedRange.start &&
                seg.end <= recentlyReplacedRange.end;

              if (isRecentlyReplaced) {
                return (
                  <span
                    key={`flash-${seg.start}-${seg.end}-${idx}`}
                    data-match-id={primary?.id}
                    className="rounded-[3px] bg-[#BBF7D0] py-[2px] ring-2 ring-[#4ADE80]/70 transition-all duration-500 !text-transparent"
                  >
                    {seg.text}
                  </span>
                );
              }

              if (!primary) {
                return (
                  <span key={`${seg.start}-${seg.end}-${idx}`}>{seg.text}</span>
                );
              }

              const meta = CATEGORY_META[primary.category];
              const isSelected = selectedMatchId === primary.id;
              const isHoveredVisual =
                !isSelected && hoveredVisualMatchId === primary.id;

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
                  data-match-id={primary.id}
                  className={`rounded-[3px] py-[2px] transition-all duration-150 ${
                    isSelected
                      ? meta.bgActiveClass
                      : isHoveredVisual
                      ? `${meta.bgClass} brightness-[0.94] border-b border-current`
                      : meta.bgClass
                  } ${secondaryBorder} ${
                    primary.isDeepScan
                      ? "underline decoration-[#6D28D9] decoration-dotted underline-offset-4"
                      : ""
                  } !text-transparent`}
                >
                  {seg.text}
                </span>
              );
            })}
            {text.endsWith("\n") ? "\n\u200b" : "\u200b"}
          </div>

          {/* Layer 2: Always-Editable Native Textarea locked to full grid height */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              const nextCaret = e.target.selectionStart;
              captureViewportSnapshot(nextCaret, false);
              onChangeText(e.target.value);
              window.requestAnimationFrame(handleCursorMoveOrKeyUp);
            }}
            onScroll={(e) => {
              if (e.currentTarget.scrollTop !== 0) {
                e.currentTarget.scrollTop = 0;
              }
            }}
            onClick={handleTextareaClick}
            onKeyUp={handleCursorMoveOrKeyUp}
            placeholder="Start writing or paste your text here..."
            spellCheck={true}
            className="z-10 col-start-1 row-start-1 h-full min-h-[620px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 m-0 font-editorial whitespace-pre-wrap break-words text-[19px] leading-[1.9] tracking-[-0.005em] text-[#1C1917] caret-[#1C1917] placeholder-[#A8A29E] selection:bg-[#1C1917]/15 focus:outline-none"
          />
        </div>

        {/* Subtle helper note at bottom of manuscript */}
        <div className="mt-10 border-t border-[#E6E0D4] pt-4 text-xs text-[#78716C] flex flex-wrap items-center justify-between gap-2">
          <span>
            Click any highlighted phrase to open AI rewrite tools. Press{" "}
            <kbd className="rounded border border-[#D6CFC1] bg-[#F4F0E8] px-1.5 py-0.5 font-mono text-[11px] text-[#44403C]">
              Esc
            </kbd>{" "}
            or click outside to close.
          </span>
          <span>{matches.length} total AI tells detected</span>
        </div>
      </div>

      {/* CLICK-ONLY FLOATING DIAGNOSTIC & MANUAL EDIT POPOVER */}
      {mode === "edit" && activeMatch && popoverCoords && (
        <div
          ref={popoverRef}
          onMouseDown={(e) => {
            // Keep focus in the main editor unless clicking inside the manual edit textarea
            const target = e.target as HTMLElement;
            if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
              e.preventDefault();
            }
          }}
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
          className="absolute z-40 w-[390px] max-w-[calc(100vw-32px)] rounded-xl border border-[#D6CFC1] bg-white p-4 shadow-xl transition-opacity duration-150"
        >
          {/* Popover Header + Dismiss (×) */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{
                  backgroundColor: CATEGORY_META[activeMatch.category].dotColor,
                }}
              />
              <span className="font-semibold text-[#1C1917]">
                {activeMatch.subcategory}
              </span>
              {activeMatch.modelUsed && (
                <>
                  <span aria-hidden="true" className="text-[#A8A29E]">
                    ·
                  </span>
                  <span className="font-mono-tabular text-[11px] font-medium text-[#6D28D9]">
                    {activeMatch.modelUsed}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDismissPopover}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#78716C] hover:bg-[#F3EFE6] hover:text-[#1C1917] transition-colors whitespace-nowrap shrink-0"
              title="Dismiss popover (Esc)"
              aria-label="Dismiss popover"
            >
              <span>Dismiss</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Explanation */}
          <p className="mb-3 text-xs leading-relaxed text-[#44403C]">
            {activeMatch.reason}
          </p>

          {/* Manual Edit Box Inside the Popover */}
          <div className="mb-3.5 rounded-lg border border-[#DCD5C7] bg-[#FBF9F5] p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <label
                htmlFor="popover-manual-edit"
                className="font-semibold text-[#292524]"
              >
                Manual Edit (press Enter to apply):
              </label>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleApplyManualEdit}
                disabled={manualEditValue === activeMatch.text}
                className="inline-flex items-center gap-1 rounded bg-[#1C1917] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#332E2A] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="h-3 w-3" />
                <span>Apply Edit</span>
              </button>
            </div>
            <textarea
              id="popover-manual-edit"
              value={manualEditValue}
              onFocus={() => setIsManualInputFocused(true)}
              onBlur={() => setIsManualInputFocused(false)}
              onChange={(e) => setManualEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleApplyManualEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleDismissPopover();
                }
              }}
              rows={Math.min(
                4,
                Math.max(1, Math.ceil(manualEditValue.length / 48))
              )}
              className="font-editorial w-full resize-y rounded border border-[#E6E0D4] bg-white px-2.5 py-1.5 text-xs leading-relaxed text-[#1C1917] focus:border-[#1C1917] focus:outline-none"
            />
          </div>

          {/* 1-Click Human Replacements */}
          {activeMatch.replacements && activeMatch.replacements.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-[#78716C]">
                1-Click Human Replacements:
              </div>
              {activeMatch.replacements.map((rep, idx) => (
                <button
                  key={`${activeMatch.id}-rep-${idx}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
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
              type="button"
              onMouseDown={(e) => e.preventDefault()}
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
              type="button"
              onMouseDown={(e) => e.preventDefault()}
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
