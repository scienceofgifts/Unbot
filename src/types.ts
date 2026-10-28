export type HighlightCategory = "red" | "purple" | "yellow" | "blue" | "orange";

export interface CategoryMeta {
  id: HighlightCategory;
  name: string;
  shortLabel: string;
  description: string;
  bgClass: string;
  bgActiveClass: string;
  borderClass: string;
  textClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  cardBgClass: string;
  cardBorderClass: string;
  dotColor: string;
}

export interface IssueMatch {
  id: string;
  category: HighlightCategory;
  subcategory: string;
  start: number;
  end: number;
  text: string;
  reason: string;
  replacements: string[];
  isDeepScan?: boolean;
}

export interface SentenceMetric {
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount: number;
  isMonotonous: boolean;
}

export interface DocumentStats {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  readingTimeSec: number;
}

export interface AnalysisResult {
  matches: IssueMatch[];
  sentences: SentenceMetric[];
  stats: DocumentStats;
  humanityScore: number;
  gradeLabel: string;
  gradeSubtext: string;
  gradeColorClass: string;
  categoryCounts: Record<HighlightCategory, number>;
}

export interface DeepScanResponse {
  overallAssessment: string;
  semanticIssues: Array<{
    exactQuote: string;
    category: string;
    subcategory: string;
    reason: string;
    replacements: string[];
  }>;
  contextualRewrites: Array<{
    id: string;
    replacements: string[];
  }>;
}
