import React, { useState } from "react";
import { Eye, EyeOff, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { AnalysisResult, HighlightCategory } from "../types";
import { CATEGORY_META } from "../detectionEngine";

interface SidebarProps {
  analysis: AnalysisResult;
  activeCategoryFilter: HighlightCategory | null;
  onToggleCategoryFilter: (category: HighlightCategory) => void;
  deepScanCount: number;
}

const ORDERED_CATEGORIES: HighlightCategory[] = [
  "red",
  "purple",
  "yellow",
  "blue",
  "orange",
];

export const Sidebar: React.FC<SidebarProps> = ({
  analysis,
  activeCategoryFilter,
  onToggleCategoryFilter,
  deepScanCount,
}) => {
  const [hoveredSentenceIdx, setHoveredSentenceIdx] = useState<number | null>(
    null
  );
  const [showAllStats, setShowAllStats] = useState<boolean>(true);

  const {
    humanityScore,
    gradeLabel,
    gradeSubtext,
    gradeColorClass,
    sentences,
    stats,
    categoryCounts,
  } = analysis;

  const maxSentenceWords = Math.max(
    28,
    ...sentences.map((s) => s.wordCount)
  );

  const hoveredSentence =
    hoveredSentenceIdx !== null ? sentences[hoveredSentenceIdx] : null;

  return (
    <aside className="w-full lg:w-[30%] lg:min-w-[340px] lg:max-w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#E4DEC9] bg-[#F4F0E8] px-6 py-6 overflow-y-auto">
      {/* 1. HUMANITY SCORE & GRADE BADGE */}
      <div className="pb-5 border-b border-[#E2DAC9]">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-[#57534E]">
            Humanity Score
          </span>
          <span className="font-mono-tabular text-xs font-semibold text-[#57534E]">
            Aim for 80+
          </span>
        </div>

        <div className="flex items-baseline gap-2.5 mt-1">
          <span className="font-mono-tabular text-3xl font-bold tracking-tight text-[#1C1917]">
            {humanityScore}
            <span className="text-base font-normal text-[#78716C]">/100</span>
          </span>
          <span className="text-sm text-[#A8A29E]" aria-hidden="true">
            —
          </span>
          <span className={`text-base font-bold tracking-tight ${gradeColorClass}`}>
            {gradeLabel}
          </span>
        </div>

        <p className="mt-1 text-xs text-[#57534E]">{gradeSubtext}</p>

        {/* Meter bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-[#E4DEC9]">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${humanityScore}%`,
              backgroundColor:
                humanityScore >= 80
                  ? "#15803D"
                  : humanityScore >= 55
                  ? "#D97706"
                  : "#C93B37",
            }}
          />
        </div>
      </div>

      {/* 2. BURSTINESS SPARKLINE (Sentence Length Rhythm) */}
      <div className="py-5 border-b border-[#E2DAC9]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#57534E]" />
            <span className="text-xs font-semibold text-[#1C1917]">
              Burstiness Sparkline
            </span>
          </div>
          <span className="font-mono-tabular text-[11px] text-[#57534E]">
            σ = {stats.sentenceLengthStdDev}w
          </span>
        </div>

        <p className="text-[11px] text-[#6B635B] mb-3 leading-normal">
          Word counts of consecutive sentences. Flat blue bars (14–22w) expose robotic cadence; jagged bars show human rhythm.
        </p>

        {sentences.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-[#E2DAC9] bg-[#FBF9F5] text-xs text-[#78716C]">
            Write at least 1 sentence to plot rhythm
          </div>
        ) : (
          <div className="rounded-lg border border-[#DFD8C8] bg-[#FBF9F5] p-3">
            {/* Sparkline Bar Chart */}
            <div className="relative flex h-20 items-end gap-1.5 pt-2">
              {/* Subtle reference band for 14-22 word AI monotone zone */}
              <div
                className="pointer-events-none absolute inset-x-0 border-y border-dashed border-[#93C5FD]/70 bg-[#DBEAFE]/30"
                style={{
                  bottom: `${Math.round((14 / maxSentenceWords) * 100)}%`,
                  height: `${Math.round(((22 - 14) / maxSentenceWords) * 100)}%`,
                }}
                title="14–22 word AI monotone band"
              />

              {sentences.map((s, idx) => {
                const heightPct = Math.max(
                  12,
                  Math.min(100, Math.round((s.wordCount / maxSentenceWords) * 100))
                );
                const isHovered = hoveredSentenceIdx === idx;
                return (
                  <button
                    key={s.index}
                    type="button"
                    onMouseEnter={() => setHoveredSentenceIdx(idx)}
                    onMouseLeave={() => setHoveredSentenceIdx(null)}
                    onClick={() =>
                      setHoveredSentenceIdx(isHovered ? null : idx)
                    }
                    className="group relative flex-1 h-full flex flex-col justify-end items-center focus:outline-none"
                    aria-label={`Sentence ${idx + 1}: ${s.wordCount} words`}
                  >
                    <div
                      className={`w-full rounded-t-xs transition-all duration-150 ${
                        s.isMonotonous
                          ? isHovered
                            ? "bg-[#1D4ED8]"
                            : "bg-[#3B82F6]"
                          : isHovered
                          ? "bg-[#1C1917]"
                          : "bg-[#78716C]/70"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Sparkline Legend / Hover Readout */}
            <div className="mt-2 border-t border-[#EDE8DF] pt-2 text-[11px] text-[#57534E] min-h-[34px] flex items-center justify-between gap-2">
              {hoveredSentence ? (
                <div className="truncate">
                  <span className="font-mono-tabular font-semibold text-[#1C1917]">
                    S{hoveredSentence.index + 1} ({hoveredSentence.wordCount} words)
                    {hoveredSentence.isMonotonous ? " · Monotonous" : ""}:
                  </span>{" "}
                  <span className="italic text-[#57534E]">
                    &ldquo;{hoveredSentence.text}&rdquo;
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full text-[11px] text-[#6B635B]">
                  <span>Hover bars to inspect sentence length</span>
                  <span className="font-mono-tabular">
                    {sentences.filter((s) => s.isMonotonous).length} flat
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. QUICK STATS */}
      <div className="py-4 border-b border-[#E2DAC9]">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-[#57534E]">Words:</span>
            <span className="font-mono-tabular text-base font-bold text-[#1C1917]">
              {stats.wordCount}
            </span>
          </div>
          <button
            onClick={() => setShowAllStats((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#57534E] hover:text-[#1C1917] transition-colors whitespace-nowrap shrink-0"
          >
            <span>{showAllStats ? "Hide stats" : "Show more stats"}</span>
            {showAllStats ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {showAllStats && (
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-[#E2DAC9] bg-[#FBF9F5] p-3 text-left">
            <div>
              <div className="text-[11px] text-[#6B635B]">Sentences</div>
              <div className="font-mono-tabular text-sm font-semibold text-[#1C1917]">
                {stats.sentenceCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#6B635B]">Avg Length</div>
              <div className="font-mono-tabular text-sm font-semibold text-[#1C1917]">
                {stats.avgSentenceLength}w
              </div>
            </div>
            <div>
              <div
                className="text-[11px] text-[#6B635B]"
                title="Standard Deviation of sentence lengths (higher = more human burstiness)"
              >
                Variance (σ)
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-[#1C1917]">
                ±{stats.sentenceLengthStdDev}w
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. FIVE COLOR-CODED COUNTER CARDS */}
      <div className="pt-5">
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#1C1917]">
            AI Pattern Diagnostics
          </span>
          <span className="text-[11px] text-[#6B635B]">
            {activeCategoryFilter
              ? "Click active card to show all"
              : "Click a card to filter"}
          </span>
        </div>

        <div className="space-y-2.5">
          {ORDERED_CATEGORIES.map((catId) => {
            const meta = CATEGORY_META[catId];
            const count = categoryCounts[catId] || 0;
            const isActive = activeCategoryFilter === catId;
            const isDimmed =
              activeCategoryFilter !== null && activeCategoryFilter !== catId;

            return (
              <button
                key={catId}
                type="button"
                onClick={() => onToggleCategoryFilter(catId)}
                className={`group w-full rounded-lg border p-3 text-left transition-all duration-150 ${
                  meta.cardBgClass
                } ${
                  isActive
                    ? "border-[#1C1917] ring-2 ring-[#1C1917]/15 shadow-xs"
                    : meta.cardBorderClass
                } ${isDimmed ? "opacity-55 hover:opacity-90" : "hover:brightness-[0.98]"}`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`font-mono-tabular inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded px-1.5 text-xs font-bold ${meta.badgeBgClass} ${meta.badgeTextClass}`}
                    >
                      {count}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-[#1C1917] leading-snug">
                        {meta.name}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#44403C]">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  <span
                    className="mt-0.5 shrink-0 text-[#57534E] group-hover:text-[#1C1917]"
                    title={
                      isActive
                        ? "Showing only this category"
                        : "Filter editor by this category"
                    }
                  >
                    {isDimmed ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {deepScanCount > 0 && (
          <div className="mt-4 rounded-lg border border-[#D8BFF2] bg-[#F2EAFA] px-3 py-2 text-xs text-[#3B195E]">
            <span className="font-mono-tabular font-bold">{deepScanCount}</span>{" "}
            additional semantic tells surfaced by Gemini Deep Scan (dotted underline in editor).
          </div>
        )}
      </div>
    </aside>
  );
};
