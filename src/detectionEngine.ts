import {
  AnalysisResult,
  CategoryMeta,
  HighlightCategory,
  IssueMatch,
  SentenceMetric,
} from "./types";

export const CATEGORY_META: Record<HighlightCategory, CategoryMeta> = {
  red: {
    id: "red",
    name: "Structural AI Crutches",
    shortLabel: "Structural Crutches",
    description: "Negative parallelism ('Not X, it's Y') & participial '-ing' summary tails.",
    bgClass: "bg-[#FDE2E1] hover:bg-[#F9C6C5] text-[#5C1614]",
    bgActiveClass: "bg-[#F9B4B2] ring-2 ring-[#C93B37] text-[#450D0B]",
    borderClass: "border-[#E68A87]",
    textClass: "text-[#9E2A26]",
    badgeBgClass: "bg-[#C93B37]",
    badgeTextClass: "text-white",
    cardBgClass: "bg-[#FCE8E7]",
    cardBorderClass: "border-[#F2B8B5]",
    dotColor: "#C93B37",
  },
  purple: {
    id: "purple",
    name: "AI Vocabulary Clichés",
    shortLabel: "AI Vocabulary",
    description: "Overused LLM verbs, grandiose nouns, and stiff academic transitions.",
    bgClass: "bg-[#EDE2F8] hover:bg-[#DEC9F3] text-[#3B195E]",
    bgActiveClass: "bg-[#D1B3F0] ring-2 ring-[#7C3AED] text-[#2B0F47]",
    borderClass: "border-[#C19EE8]",
    textClass: "text-[#6D28D9]",
    badgeBgClass: "bg-[#7C3AED]",
    badgeTextClass: "text-white",
    cardBgClass: "bg-[#F2EAFA]",
    cardBorderClass: "border-[#D8BFF2]",
    dotColor: "#7C3AED",
  },
  yellow: {
    id: "yellow",
    name: "Throat-Clearing & Hedging",
    shortLabel: "Openers & Hedging",
    description: "Cliché essay openers and timid RLHF fence-sitting formulas.",
    bgClass: "bg-[#FEF0C7] hover:bg-[#FDE293] text-[#573B08]",
    bgActiveClass: "bg-[#FCD668] ring-2 ring-[#D97706] text-[#422B04]",
    borderClass: "border-[#F5C451]",
    textClass: "text-[#B45309]",
    badgeBgClass: "bg-[#D97706]",
    badgeTextClass: "text-white",
    cardBgClass: "bg-[#FDF4D7]",
    cardBorderClass: "border-[#F7D782]",
    dotColor: "#D97706",
  },
  blue: {
    id: "blue",
    name: "Metronomic Cadence",
    shortLabel: "Robotic Cadence",
    description: "Runs of 3+ sentences with uniform length (14–22 words) or <3 word variance.",
    bgClass: "bg-[#DCEEFF] hover:bg-[#C2E0FF] text-[#12385E]",
    bgActiveClass: "bg-[#A8D2FF] ring-2 ring-[#2563EB] text-[#0D2847]",
    borderClass: "border-[#84BEFF]",
    textClass: "text-[#1D4ED8]",
    badgeBgClass: "bg-[#2563EB]",
    badgeTextClass: "text-white",
    cardBgClass: "bg-[#E6F2FF]",
    cardBorderClass: "border-[#B3D7FF]",
    dotColor: "#2563EB",
  },
  orange: {
    id: "orange",
    name: "Formatting & Symmetry Tells",
    shortLabel: "Formatting Tells",
    description: "Bold colon bullet lists and predictable 'In conclusion' wrap-ups.",
    bgClass: "bg-[#FFE6D5] hover:bg-[#FFD1B3] text-[#5E280A]",
    bgActiveClass: "bg-[#FFBC91] ring-2 ring-[#EA580C] text-[#451B05]",
    borderClass: "border-[#FCA670]",
    textClass: "text-[#C2410C]",
    badgeBgClass: "bg-[#EA580C]",
    badgeTextClass: "text-white",
    cardBgClass: "bg-[#FFEDE0]",
    cardBorderClass: "border-[#FDB88B]",
    dotColor: "#EA580C",
  },
};

interface VocabEntry {
  subcategory: string;
  reason: string;
  replacements: [string, string];
}

const VOCAB_DICTIONARY: Record<string, VocabEntry> = {
  // Overused Verbs
  delve: {
    subcategory: "Overused AI Verb",
    reason: "'Delve' is one of the highest-frequency ChatGPT tell words. Use a plain, direct verb.",
    replacements: ["explore", "examine"],
  },
  delves: {
    subcategory: "Overused AI Verb",
    reason: "'Delves' is a classic LLM verb cliché. Replace with concrete action.",
    replacements: ["explores", "digs into"],
  },
  delving: {
    subcategory: "Overused AI Verb",
    reason: "'Delving' signals synthetic prose. Use a simpler everyday verb.",
    replacements: ["digging", "looking"],
  },
  underscore: {
    subcategory: "Overused AI Verb",
    reason: "AI constantly 'underscores' points instead of showing them.",
    replacements: ["show", "prove"],
  },
  underscores: {
    subcategory: "Overused AI Verb",
    reason: "AI overuses 'underscores' to claim importance. Use a direct verb.",
    replacements: ["shows", "proves"],
  },
  underscoring: {
    subcategory: "Overused AI Verb",
    reason: "AI tacks on 'underscoring' to editorialize. Keep it concrete.",
    replacements: ["showing", "proving"],
  },
  foster: {
    subcategory: "Overused AI Verb",
    reason: "'Foster' is vague corporate-AI filler. Say how it's actually built.",
    replacements: ["build", "encourage"],
  },
  fosters: {
    subcategory: "Overused AI Verb",
    reason: "'Fosters' sounds like an HR press release written by an LLM.",
    replacements: ["builds", "encourages"],
  },
  harness: {
    subcategory: "Overused AI Verb",
    reason: "Humans rarely 'harness' tools in casual or sharp prose—they just use them.",
    replacements: ["use", "apply"],
  },
  harnessing: {
    subcategory: "Overused AI Verb",
    reason: "'Harnessing' inflates simple tool usage into grandiose rhetoric.",
    replacements: ["using", "putting to work"],
  },
  navigate: {
    subcategory: "Overused AI Verb",
    reason: "AI 'navigates' every abstract problem. Use a literal verb.",
    replacements: ["handle", "manage"],
  },
  navigating: {
    subcategory: "Overused AI Verb",
    reason: "'Navigating' is an overused metaphor in AI essays.",
    replacements: ["handling", "working through"],
  },
  embark: {
    subcategory: "Overused AI Verb",
    reason: "Unless you are boarding a ship, 'embark' sounds melodramatic and synthetic.",
    replacements: ["start", "begin"],
  },
  unleash: {
    subcategory: "Overused AI Verb",
    reason: "'Unleash' is hype-heavy AI copywriting. Ground the verb.",
    replacements: ["unlock", "release"],
  },
  unleashing: {
    subcategory: "Overused AI Verb",
    reason: "'Unleashing' is hyperbolic AI marketing language.",
    replacements: ["freeing up", "opening"],
  },
  elevate: {
    subcategory: "Overused AI Verb",
    reason: "'Elevate' is generic AI polish. Say how it actually improves.",
    replacements: ["improve", "raise"],
  },
  elevating: {
    subcategory: "Overused AI Verb",
    reason: "'Elevating' is a vague AI intensifier.",
    replacements: ["improving", "raising"],
  },
  streamline: {
    subcategory: "Overused AI Verb",
    reason: "'Streamline' is overused in B2B AI drafts. Use a sharper verb.",
    replacements: ["simplify", "speed up"],
  },
  streamlining: {
    subcategory: "Overused AI Verb",
    reason: "'Streamlining' is corporate boilerplate.",
    replacements: ["simplifying", "speeding up"],
  },
  revolutionize: {
    subcategory: "Overused AI Verb",
    reason: "AI claims everything 'revolutionizes' an industry. State the real change.",
    replacements: ["reshape", "overhaul"],
  },
  spearhead: {
    subcategory: "Overused AI Verb",
    reason: "'Spearhead' is resume-bot jargon. Use 'lead' or 'run'.",
    replacements: ["lead", "run"],
  },
  bolster: {
    subcategory: "Overused AI Verb",
    reason: "'Bolster' is disproportionately favored by LLMs over 'strengthen' or 'back'.",
    replacements: ["strengthen", "support"],
  },
  skyrocket: {
    subcategory: "Overused AI Verb",
    reason: "'Skyrocket' is breathless AI hype. Prefer specific numbers or plain verbs.",
    replacements: ["jump", "climb"],
  },

  // Grandiose Nouns & Adjectives
  tapestry: {
    subcategory: "Grandiose AI Noun",
    reason: "'Tapestry' (especially 'rich/intricate tapestry') is the #1 metaphorical tell of LLM prose.",
    replacements: ["mix", "web"],
  },
  testament: {
    subcategory: "Grandiose AI Noun",
    reason: "'A testament to...' is a stock LLM phrase used to manufacture gravitas.",
    replacements: ["proof", "evidence"],
  },
  beacon: {
    subcategory: "Grandiose AI Noun",
    reason: "'Beacon' is overly dramatic AI praise.",
    replacements: ["guide", "model"],
  },
  realm: {
    subcategory: "Grandiose AI Noun",
    reason: "'In the realm of...' is fantasy-tinged AI padding. Name the field directly.",
    replacements: ["field", "world"],
  },
  landscape: {
    subcategory: "Grandiose AI Noun",
    reason: "AI calls every industry or topic a 'landscape'. Use a specific noun.",
    replacements: ["market", "field"],
  },
  catalyst: {
    subcategory: "Grandiose AI Noun",
    reason: "'Catalyst' is textbook AI essay vocabulary.",
    replacements: ["spark", "driver"],
  },
  paradigm: {
    subcategory: "Grandiose AI Noun",
    reason: "'Paradigm' sounds pretentious and robotic. Use 'model' or 'approach'.",
    replacements: ["model", "approach"],
  },
  synergy: {
    subcategory: "Grandiose AI Noun",
    reason: "'Synergy' is empty corporate buzzword filler.",
    replacements: ["teamwork", "alignment"],
  },
  cornerstone: {
    subcategory: "Grandiose AI Noun",
    reason: "'Cornerstone' is an overused architectural cliché in AI writing.",
    replacements: ["foundation", "core"],
  },
  crucial: {
    subcategory: "Grandiose AI Adjective",
    reason: "AI labels everything 'crucial' or 'pivotal'. Use plain emphasis.",
    replacements: ["vital", "key"],
  },
  crucially: {
    subcategory: "Grandiose AI Adverb",
    reason: "Starting sentences with 'Crucially,' is a frequent LLM transition habit.",
    replacements: ["More importantly", "Above all"],
  },
  pivotal: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Pivotal' appears 10x more often in LLM outputs than in human writing.",
    replacements: ["key", "decisive"],
  },
  intricate: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Intricate' is an automatic AI modifier before 'tapestry', 'dance', or 'web'.",
    replacements: ["complex", "detailed"],
  },
  vibrant: {
    subcategory: "Grandiose AI Adjective",
    reason: "AI describes every community or ecosystem as 'vibrant'. Show, don't tell.",
    replacements: ["lively", "active"],
  },
  multifaceted: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Multifaceted' is academic filler that adds zero concrete imagery.",
    replacements: ["complex", "layered"],
  },
  seamless: {
    subcategory: "Grandiose AI Adjective",
    reason: "AI calls every workflow 'seamless'. Use 'smooth' or 'frictionless'.",
    replacements: ["smooth", "easy"],
  },
  groundbreaking: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Groundbreaking' is generic press-release hype.",
    replacements: ["new", "original"],
  },
  indelible: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Indelible mark' is a frozen LLM cliché.",
    replacements: ["lasting", "permanent"],
  },
  overarching: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Overarching' is bureaucratic padding.",
    replacements: ["main", "central"],
  },
  burgeoning: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Burgeoning' is a literary cliché over-indexed by language models.",
    replacements: ["growing", "fast-growing"],
  },
  relentless: {
    subcategory: "Grandiose AI Adjective",
    reason: "'Relentless' is melodramatic AI intensifier prose.",
    replacements: ["steady", "nonstop"],
  },
  nuanced: {
    subcategory: "Grandiose AI Adjective",
    reason: "LLMs love calling their own fence-sitting 'nuanced'.",
    replacements: ["subtle", "specific"],
  },

  // Stiff Transitions
  moreover: {
    subcategory: "Stiff Transition",
    reason: "AI relies heavily on 'Moreover,' to glue paragraphs together mechanically.",
    replacements: ["Also", "Beyond that"],
  },
  furthermore: {
    subcategory: "Stiff Transition",
    reason: "'Furthermore' makes prose sound like an automated 5-paragraph essay.",
    replacements: ["Plus", "What's more"],
  },
  consequently: {
    subcategory: "Stiff Transition",
    reason: "'Consequently' is stiff and formal. Prefer 'So' or 'As a result'.",
    replacements: ["So", "As a result"],
  },
  nonetheless: {
    subcategory: "Stiff Transition",
    reason: "'Nonetheless' feels stiff and bookish in modern prose.",
    replacements: ["Still", "Even so"],
  },
  hence: {
    subcategory: "Stiff Transition",
    reason: "'Hence' is archaic transition filler favored by LLMs.",
    replacements: ["So", "That's why"],
  },
  thus: {
    subcategory: "Stiff Transition",
    reason: "'Thus' sounds stiffly deductive. Use 'so' or rephrase.",
    replacements: ["so", "from there"],
  },
  "moving forward": {
    subcategory: "Stiff Transition",
    reason: "'Moving forward' is corporate filler. Cut it or say 'Next'.",
    replacements: ["Next", "From now on"],
  },
  "at its core": {
    subcategory: "Stiff Transition",
    reason: "'At its core,' is a signature LLM throat-clearing transition.",
    replacements: ["Basically", "In plain terms"],
  },
  "it is worth noting": {
    subcategory: "Stiff Transition",
    reason: "If it's worth noting, just state the fact directly.",
    replacements: ["Notably", "Keep in mind"],
  },
  "in light of this": {
    subcategory: "Stiff Transition",
    reason: "Wordy connective tissue. Replace with 'Because of this' or 'So'.",
    replacements: ["Because of this", "Given this"],
  },
  "by and large": {
    subcategory: "Stiff Transition",
    reason: "Idiom padding that weakens sentence momentum.",
    replacements: ["Mostly", "Generally"],
  },
};

function preserveCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function analyzeDocument(
  text: string,
  deepScanMatches: IssueMatch[] = []
): AnalysisResult {
  const matches: IssueMatch[] = [];
  let matchCounter = 0;

  const nextId = (prefix: string) => `${prefix}-${++matchCounter}`;

  // =========================================================================
  // CATEGORY 1: RED — Structural AI Crutches (Negative Parallelism & Participial Tails)
  // =========================================================================
  const negativeParallelismPatterns: Array<{
    regex: RegExp;
    getReplacements: (m: RegExpExecArray) => string[];
  }> = [
    {
      // Matches both "it's not just about X, it's about Y" and "is not just about X, it's about Y"
      regex:
        /\b(?:it's|it is|this is|that's|is)\s+not\s+(?:just\s+|merely\s+|simply\s+|only\s+)?about\s+([^.,;—-]+)[,;—-]+\s*it(?:'s|\s+is)\s+about\s+([^.,;?!]+)/gi,
      getReplacements: (m) => {
        const yPart = (m[2] || "").trim();
        const xPart = (m[1] || "").trim();
        const startsWithVerb = /^is\b/i.test(m[0]);
        if (startsWithVerb) {
          return [
            `hinges on ${yPart}`,
            `requires ${yPart} alongside ${xPart}`,
          ];
        }
        return [
          `Focus on ${yPart}`,
          `The real work is ${yPart}`,
        ];
      },
    },
    {
      regex: /\bnot\s+only\s+([^.,;]+),?\s+but\s+(?:also\s+)?([^.,;?!]+)/gi,
      getReplacements: (m) => {
        const a = (m[1] || "").trim();
        const b = (m[2] || "").trim();
        return [`both ${a} and ${b}`, `${a}—and ${b}`];
      },
    },
    {
      regex: /\bless\s+about\s+([^.,;]+)\s+and\s+more\s+about\s+([^.,;?!]+)/gi,
      getReplacements: (m) => {
        const b = (m[2] || "").trim();
        return [`driven by ${b}`, `focused on ${b}`];
      },
    },
    {
      regex:
        /\bisn't\s+(?:just\s+)?a\s+([^.,;—-]+?)\s*[—,;]+\s*it's\s+a\s+([^.,;?!]+)/gi,
      getReplacements: (m) => {
        const b = (m[2] || "").trim();
        return [`works best as a ${b}`, `is a ${b}`];
      },
    },
  ];

  for (const pattern of negativeParallelismPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.regex.exec(text)) !== null) {
      matches.push({
        id: nextId("red-neg"),
        category: "red",
        subcategory: "Negative Parallelism ('Not X, it's Y')",
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        reason:
          "AI overuses 'Not X, it's Y' contrasts to manufacture depth. State what the thing actually is directly.",
        replacements: pattern.getReplacements(m),
      });
    }
  }

  // Participial Summary Tails: , (fostering|ensuring|...)\b[^.?!]+
  const participialRegex =
    /,\s+(fostering|ensuring|highlighting|underscoring|demonstrating|paving|creating|allowing|enabling|driving|unlocking|cultivating|empowering|bridging|transforming|reflecting|showcasing)\b([^.?!]+)/gi;
  {
    let m: RegExpExecArray | null;
    while ((m = participialRegex.exec(text)) !== null) {
      const verb = m[1].toLowerCase();
      const rest = (m[2] || "").trim();
      const activeVerbMap: Record<string, string> = {
        fostering: "This builds",
        ensuring: "This makes sure",
        highlighting: "This shows",
        underscoring: "This proves",
        demonstrating: "This shows",
        paving: "This opens",
        creating: "This creates",
        allowing: "This lets",
        enabling: "This helps",
        driving: "This drives",
        unlocking: "This opens up",
        cultivating: "This grows",
        empowering: "This lets",
        bridging: "This connects",
        transforming: "This changes",
        reflecting: "This reflects",
        showcasing: "This shows",
      };
      const starter = activeVerbMap[verb] || "This supports";
      matches.push({
        id: nextId("red-part"),
        category: "red",
        subcategory: "Participial Summary Tail",
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        reason:
          "AI tacks '-ing' clauses onto the end of sentences to moralize or explain significance. Cut the tail or make it a concrete separate sentence.",
        replacements: [
          `—and ${ starter.toLowerCase().replace("this ", "") } ${rest}`,
          `. ${starter} ${rest}`,
        ],
      });
    }
  }

  // =========================================================================
  // CATEGORY 2: PURPLE — AI Vocabulary Clichés
  // =========================================================================
  const vocabKeys = Object.keys(VOCAB_DICTIONARY).sort(
    (a, b) => b.length - a.length
  );
  for (const phrase of vocabKeys) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const entry = VOCAB_DICTIONARY[phrase];
      const matchedStr = m[0];
      matches.push({
        id: nextId("purple-vocab"),
        category: "purple",
        subcategory: entry.subcategory,
        start: m.index,
        end: m.index + matchedStr.length,
        text: matchedStr,
        reason: entry.reason,
        replacements: [
          preserveCase(matchedStr, entry.replacements[0]),
          preserveCase(matchedStr, entry.replacements[1]),
        ],
      });
    }
  }

  // =========================================================================
  // CATEGORY 3: YELLOW — Throat-Clearing Openers & RLHF Hedging
  // =========================================================================
  const throatClearingRules: Array<{
    regex: RegExp;
    subcategory: string;
    reason: string;
    replacements: [string, string];
  }> = [
    {
      regex: /\bin today's fast-paced(?:\s+[a-zA-Z-]+){0,2}\s*,?/gi,
      subcategory: "Throat-Clearing Opener",
      reason:
        "'In today's fast-paced...' is the most recognizable ChatGPT essay opener on the internet. Delete it or start with a concrete observation.",
      replacements: ["Today,", "Right now,"],
    },
    {
      regex: /\bin the ever-evolving\b/gi,
      subcategory: "Throat-Clearing Phrase",
      reason:
        "'In the ever-evolving...' is synthetic filler that delays your actual point.",
      replacements: ["in the changing", "in modern"],
    },
    {
      regex: /\bin an era where\b/gi,
      subcategory: "Throat-Clearing Opener",
      reason:
        "Grandiose movie-trailer opener favored by LLMs. State the condition directly.",
      replacements: ["When", "Now that"],
    },
    {
      regex: /\bin the dynamic world of\b/gi,
      subcategory: "Throat-Clearing Opener",
      reason: "Empty throat-clearing preamble. Name the industry directly.",
      replacements: ["In", "Across"],
    },
    {
      regex: /\bit is important to note(?: that)?\b/gi,
      subcategory: "Throat-Clearing Filler",
      reason:
        "RLHF throat-clearing. If it's important, just state the sentence without announcing it.",
      replacements: ["Note that", "Keep in mind:"],
    },
    {
      regex: /\bit's crucial to remember(?: that)?\b/gi,
      subcategory: "Throat-Clearing Filler",
      reason: "AI filler announcing importance instead of proving it.",
      replacements: ["Remember:", "Don't forget:"],
    },
    {
      regex: /\bwhen it comes to\s+([^,]+),\s*/gi,
      subcategory: "Throat-Clearing Opener",
      reason:
        "'When it comes to X,' is flabby conversational filler. Make X the subject or use 'For X,'.",
      replacements: ["For $1, ", "With $1, "],
    },
    {
      regex: /\bhave you ever wondered\b/gi,
      subcategory: "Cliché Rhetorical Hook",
      reason:
        "Formulaic blog intro hook. Start with a surprising fact or claim instead.",
      replacements: ["Consider why", "Why do"],
    },
    {
      regex: /\blet's dive in\b/gi,
      subcategory: "AI Cheerleader Opener",
      reason: "'Let's dive in' is a stock ChatGPT transition. Cut it completely.",
      replacements: ["Here is how it works", "Let's look at the details"],
    },
    {
      regex: /\blet's unpack\b/gi,
      subcategory: "AI Podcast/Essay Cliché",
      reason: "'Let's unpack' is overused synthetic signposting.",
      replacements: ["Let's break down", "Here's what drives"],
    },
  ];

  for (const rule of throatClearingRules) {
    let m: RegExpExecArray | null;
    while ((m = rule.regex.exec(text)) !== null) {
      const matchedStr = m[0];
      const rep0 = m[1]
        ? rule.replacements[0].replace("$1", m[1].trim())
        : preserveCase(matchedStr, rule.replacements[0]);
      const rep1 = m[1]
        ? rule.replacements[1].replace("$1", m[1].trim())
        : preserveCase(matchedStr, rule.replacements[1]);

      matches.push({
        id: nextId("yellow-opener"),
        category: "yellow",
        subcategory: rule.subcategory,
        start: m.index,
        end: m.index + matchedStr.length,
        text: matchedStr,
        reason: rule.reason,
        replacements: [rep0, rep1],
      });
    }
  }

  // RLHF Fence-Sitting / Hedging
  const rlhfWhileRegex =
    /\bwhile\s+([^.,;]+?)\s+(?:offers|provides)\s+([^.,;]+?),\s+it\s+also\s+(?:presents|poses|requires)\s+([^.?!]+)/gi;
  {
    let m: RegExpExecArray | null;
    while ((m = rlhfWhileRegex.exec(text)) !== null) {
      const subj = (m[1] || "").trim();
      const pro = (m[2] || "").trim();
      const con = (m[3] || "").trim();
      matches.push({
        id: nextId("yellow-rlhf"),
        category: "yellow",
        subcategory: "RLHF Fence-Sitting ('While X offers..., it also presents...')",
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        reason:
          "Classic RLHF safety hedging: balancing a generic benefit with a generic drawback in one symmetrical sentence. Take a sharper stance.",
        replacements: [
          `${preserveCase(m[0], subj)} gives teams ${pro}, but breaks down without ${con.replace(/^significant\s+/i, "")}`,
          `${preserveCase(m[0], subj)} brings ${pro}—at the cost of ${con}`,
        ],
      });
    }
  }

  const hedgingPhrases: Array<{
    regex: RegExp;
    replacements: [string, string];
  }> = [
    {
      regex: /\bstrik(?:e|ing) a balance between\b/gi,
      replacements: ["balancing", "weighing"],
    },
    {
      regex: /\bfinding a balanced approach\b/gi,
      replacements: ["choosing clear trade-offs", "setting clear rules"],
    },
    {
      regex: /\ba double-edged sword\b/gi,
      replacements: ["a sharp trade-off", "a risky bet"],
    },
    {
      regex: /\bnuanced approach\b/gi,
      replacements: ["targeted strategy", "practical plan"],
    },
  ];

  for (const hp of hedgingPhrases) {
    let m: RegExpExecArray | null;
    while ((m = hp.regex.exec(text)) !== null) {
      matches.push({
        id: nextId("yellow-hedge"),
        category: "yellow",
        subcategory: "RLHF Hedging Cliché",
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        reason:
          "AI defaults to non-committal 'balance' clichés instead of naming the concrete trade-off.",
        replacements: [
          preserveCase(m[0], hp.replacements[0]),
          preserveCase(m[0], hp.replacements[1]),
        ],
      });
    }
  }

  // =========================================================================
  // CATEGORY 4: BLUE — Metronomic Cadence (Low Burstiness)
  // =========================================================================
  // Extract sentences with character offsets
  const sentences: SentenceMetric[] = [];
  const sentenceRegex = /[^.?!\n]+[.?!]+(?:\s|$)|[^.?!\n]+(?=\n|$)/g;
  let sm: RegExpExecArray | null;
  while ((sm = sentenceRegex.exec(text)) !== null) {
    const raw = sm[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // Skip pure bullet header lines from cadence run if they start with - or *
    const leadingTrimOffset = raw.indexOf(trimmed);
    const startIdx = sm.index + leadingTrimOffset;
    const endIdx = startIdx + trimmed.length;
    const words = trimmed
      .replace(/[*_#`~—-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length >= 2) {
      sentences.push({
        index: sentences.length,
        text: trimmed,
        start: startIdx,
        end: endIdx,
        wordCount: words.length,
        isMonotonous: false,
      });
    }
  }

  // Detect runs of 3 or more consecutive sentences where:
  // (A) Every sentence falls between 14 and 22 words, OR
  // (B) Word count difference between consecutive sentences is < 3 words
  const n = sentences.length;
  if (n >= 3) {
    const inRun = new Array<boolean>(n).fill(false);

    for (let i = 0; i <= n - 3; i++) {
      // Check how far a valid run extends starting at i
      let jInBand = i;
      while (
        jInBand < n &&
        sentences[jInBand].wordCount >= 14 &&
        sentences[jInBand].wordCount <= 22 &&
        !/^(\*|-|\d+\.)\s/.test(sentences[jInBand].text)
      ) {
        jInBand++;
      }
      if (jInBand - i >= 3) {
        for (let k = i; k < jInBand; k++) inRun[k] = true;
      }

      // Also check consecutive difference < 3 words
      let jDiff = i + 1;
      while (
        jDiff < n &&
        Math.abs(sentences[jDiff].wordCount - sentences[jDiff - 1].wordCount) <
          3 &&
        !/^(\*|-|\d+\.)\s/.test(sentences[jDiff].text) &&
        !/^(\*|-|\d+\.)\s/.test(sentences[jDiff - 1].text)
      ) {
        jDiff++;
      }
      if (jDiff - i >= 3) {
        for (let k = i; k < jDiff; k++) inRun[k] = true;
      }
    }

    // Group contiguous monotonous sentences and create matches
    let idx = 0;
    while (idx < n) {
      if (!inRun[idx]) {
        idx++;
        continue;
      }
      let runEnd = idx;
      while (runEnd + 1 < n && inRun[runEnd + 1]) {
        runEnd++;
      }
      const runSentences = sentences.slice(idx, runEnd + 1);
      const lengthsStr = runSentences.map((s) => `${s.wordCount}w`).join(", ");

      for (const s of runSentences) {
        s.isMonotonous = true;
        // Generate a punchy short rewrite option for each sentence in the monotonous block
        const words = s.text.split(/\s+/);
        const shortPunchy =
          words.length > 9
            ? words.slice(0, 6).join(" ").replace(/[,;:]$/, "") + "."
            : s.text;

        matches.push({
          id: nextId("blue-cadence"),
          category: "blue",
          subcategory: `Metronomic Cadence (${lengthsStr})`,
          start: s.start,
          end: s.end,
          text: s.text,
          reason:
            "Metronomic cadence: These consecutive sentences have nearly identical lengths. Combine two sentences or chop one into a blunt fragment under 7 words.",
          replacements: [
            shortPunchy,
            `${s.text.replace(/\.$/, "")}—Every single day.`,
          ],
        });
      }

      idx = runEnd + 1;
    }
  }

  // =========================================================================
  // CATEGORY 5: ORANGE — Formatting & Symmetry Tells
  // =========================================================================
  // 5A. Colon Bullet Headers: ^(\*|-|\d+\.)\s*(\*\*[^*]+\*\*|[A-Z][a-zA-Z\s]{2,25}):\s+
  const colonBulletRegex =
    /^(\*|-|\d+\.)\s*(\*\*[^*]+\*\*|[A-Z][a-zA-Z\s]{2,25}):\s+/gm;
  {
    let m: RegExpExecArray | null;
    while ((m = colonBulletRegex.exec(text)) !== null) {
      const marker = m[1];
      const rawTitle = m[2].replace(/\*\*/g, "").trim();
      matches.push({
        id: nextId("orange-bullet"),
        category: "orange",
        subcategory: "Bold Colon Bullet Header",
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        reason:
          "LLMs reflexively format bullet lists as '**Bold Noun Phrase**: explanation'. Start the bullet directly with an active verb or natural sentence.",
        replacements: [`${marker} Use ${rawTitle.toLowerCase()} so `, `${marker} `],
      });
    }
  }

  // 5B. Summary Conclusions in the final paragraph
  const paragraphs = text.split(/\n\s*\n/);
  if (paragraphs.length > 0) {
    let lastNonEmptyIdx = paragraphs.length - 1;
    while (lastNonEmptyIdx >= 0 && !paragraphs[lastNonEmptyIdx].trim()) {
      lastNonEmptyIdx--;
    }
    if (lastNonEmptyIdx >= 0) {
      const lastPara = paragraphs[lastNonEmptyIdx];
      const lastParaStart = text.lastIndexOf(lastPara);
      const conclusionRegex =
        /^\s*(In conclusion|Ultimately|In summary|To wrap up|All in all|As we move forward)\b,?\s*/i;
      const cm = conclusionRegex.exec(lastPara);
      if (cm && lastParaStart !== -1) {
        const fullParaMatchEnd = lastParaStart + lastPara.trimEnd().length;
        const withoutOpener = lastPara.slice(cm[0].length).trim();
        const capitalizedRest =
          withoutOpener.charAt(0).toUpperCase() + withoutOpener.slice(1);
        matches.push({
          id: nextId("orange-conclusion"),
          category: "orange",
          subcategory: "Predictable Summary Conclusion",
          start: lastParaStart,
          end: fullParaMatchEnd,
          text: lastPara.trimEnd(),
          reason: `Starting your final paragraph with "${cm[1].trim()}" announces a book-report wrap-up. Cut the signpost and end on a sharp, forward-looking observation.`,
          replacements: [
            capitalizedRest,
            `The takeaway is simple: ${withoutOpener.charAt(0).toLowerCase() + withoutOpener.slice(1)}`,
          ],
        });
      }
    }
  }

  // =========================================================================
  // MERGE GEMINI DEEP SCAN MATCHES (if any still match verbatim in current text)
  // =========================================================================
  for (const dm of deepScanMatches) {
    if (!dm.text) continue;
    const foundIdx = text.indexOf(dm.text);
    if (foundIdx !== -1) {
      // Avoid exact duplicate start/end
      const isDup = matches.some(
        (existing) =>
          existing.start === foundIdx &&
          existing.end === foundIdx + dm.text.length &&
          existing.subcategory === dm.subcategory
      );
      if (!isDup) {
        matches.push({
          ...dm,
          start: foundIdx,
          end: foundIdx + dm.text.length,
          isDeepScan: true,
        });
      }
    }
  }

  // =========================================================================
  // COMPUTE DOCUMENT STATS, BURSTINESS & HUMANITY SCORE
  // =========================================================================
  const allWords = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = text.trim() ? allWords.length : 0;
  const sentenceCount = sentences.length;
  const nonEmptyParagraphs = paragraphs.filter((p) => p.trim().length > 0).length;

  const avgSentenceLength =
    sentenceCount > 0
      ? Number(
          (
            sentences.reduce((acc, s) => acc + s.wordCount, 0) / sentenceCount
          ).toFixed(1)
        )
      : 0;

  let sentenceLengthStdDev = 0;
  if (sentenceCount > 1) {
    const mean =
      sentences.reduce((acc, s) => acc + s.wordCount, 0) / sentenceCount;
    const variance =
      sentences.reduce((acc, s) => acc + Math.pow(s.wordCount - mean, 2), 0) /
      sentenceCount;
    sentenceLengthStdDev = Number(Math.sqrt(variance).toFixed(1));
  }

  const categoryCounts: Record<HighlightCategory, number> = {
    red: 0,
    purple: 0,
    yellow: 0,
    blue: 0,
    orange: 0,
  };

  for (const m of matches) {
    categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
  }

  // Calculate Humanity Score (0-100)
  let humanityScore = 100;
  if (wordCount > 0) {
    const densityScale = Math.max(1, wordCount / 180);
    const penalty =
      (categoryCounts.red * 11 +
        categoryCounts.purple * 4.5 +
        categoryCounts.yellow * 8 +
        categoryCounts.blue * 5.5 +
        categoryCounts.orange * 7) /
      densityScale;

    // Bonus for high burstiness (stdDev >= 6.5), small penalty for flat stdDev (< 3.5)
    const burstinessAdjustment =
      sentenceCount >= 3
        ? sentenceLengthStdDev >= 7
          ? 6
          : sentenceLengthStdDev < 3.5
          ? -8
          : 0
        : 0;

    humanityScore = Math.round(
      Math.max(8, Math.min(100, 100 - penalty + burstinessAdjustment))
    );
  }

  let gradeLabel = "Sounds Human";
  let gradeSubtext = "Crisp voice, natural cadence.";
  let gradeColorClass = "text-[#15803D]";

  if (wordCount === 0) {
    gradeLabel = "Waiting for Draft";
    gradeSubtext = "Paste or write text to analyze AI patterns.";
    gradeColorClass = "text-[#78716C]";
  } else if (humanityScore >= 80) {
    gradeLabel = "Sounds Human";
    gradeSubtext = "Sharp diction and varied sentence rhythm.";
    gradeColorClass = "text-[#15803D]";
  } else if (humanityScore >= 55) {
    gradeLabel = "Slightly Robotic";
    gradeSubtext = "Contains noticeable LLM habits or flat cadence.";
    gradeColorClass = "text-[#B45309]";
  } else {
    gradeLabel = "Classic ChatGPT/Claude";
    gradeSubtext = "Heavy AI clichés, hedging, and metronomic rhythm.";
    gradeColorClass = "text-[#B91C1C]";
  }

  return {
    matches,
    sentences,
    stats: {
      wordCount,
      sentenceCount,
      paragraphCount: nonEmptyParagraphs,
      avgSentenceLength,
      sentenceLengthStdDev,
      readingTimeSec: Math.ceil((wordCount / 225) * 60),
    },
    humanityScore,
    gradeLabel,
    gradeSubtext,
    gradeColorClass,
    categoryCounts,
  };
}
