// Diagnosis scoring logic

export type ScoreKey =
  | "cafe"
  | "nightlife"
  | "quiet"
  | "nature"
  | "family"
  | "shopping"
  | "gourmet"
  | "access"
  | "cost"
  | "safety";

export type FacilityCounts = {
  cafe?: number;
  supermarket?: number;
  park?: number;
  hospital?: number;
  gourmet?: number;
};

export type RentRange = {
  "1LDK"?: number; // yen
  "2LDK"?: number;
  "3LDK"?: number;
};

export type CommuteHubs = {
  "東京"?: number; // minutes
  "渋谷"?: number;
  "新宿"?: number;
};

export type TownProfile = {
  code: string;
  name: string;
  pref: string;
  tags: string[];
  scores: Record<ScoreKey, number>;
  rent2ldk: number;
  description: string;
  imageUrl?: string;
  // Objective facts (optional for backward compatibility)
  facilities?: FacilityCounts;
  lines?: number;
  lineNames?: string[]; // e.g. ["東急田園都市線", "東急世田谷線"]
  rentAvg2LDK?: number;
  rentRange?: RentRange;
  commuteHubs?: CommuteHubs;
  topSpots?: string[]; // 代表的なスポット（Google Places 高評価）
  photos?: string[]; // 複数枚の写真URL
  location?: { lat: number; lng: number };
};

export type QuestionOption = {
  icon: string;
  label: string;
  effects: Partial<Record<ScoreKey, number>>;
};

export type Question = {
  id: string;
  title: string;
  subtitle?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
};

export const QUESTIONS: Question[] = [
  {
    id: "lifestyle",
    title: "二人の休日、どう過ごしたい？",
    options: [
      { icon: "🛋️", label: "家でまったり", effects: { quiet: 5, nature: 2 } },
      { icon: "☕", label: "カフェやお店巡り", effects: { cafe: 5, shopping: 3 } },
      { icon: "🌳", label: "公園でのんびり", effects: { nature: 5, quiet: 3 } },
      { icon: "🍷", label: "おいしいお店で食事", effects: { gourmet: 5, nightlife: 3 } },
    ],
  },
  {
    id: "scenery",
    title: "帰り道、理想の風景は？",
    options: [
      { icon: "🌃", label: "ネオンが光る賑やかな通り", effects: { nightlife: 5, access: 3 } },
      { icon: "🏘️", label: "商店街のある下町", effects: { cost: 3, shopping: 4, gourmet: 3 } },
      { icon: "🌿", label: "緑が多い静かな住宅街", effects: { quiet: 5, nature: 4 } },
      { icon: "🏙️", label: "おしゃれな並木道", effects: { cafe: 4, safety: 3 } },
    ],
  },
  {
    id: "supermarket",
    title: "スーパー、どっちが大事？",
    options: [
      { icon: "🛒", label: "安くて品揃え豊富", effects: { cost: 5 } },
      { icon: "🥑", label: "品質重視（成城石井派）", effects: { cafe: 3, safety: 2 } },
      { icon: "🏪", label: "近さ重視（コンビニでOK）", effects: { access: 3 } },
      { icon: "🛍️", label: "大型モールが近い方がいい", effects: { shopping: 5 } },
    ],
  },
  {
    id: "commute",
    title: "通勤、どこまで許せる？",
    options: [
      { icon: "⚡", label: "15分以内！", effects: { access: 5 } },
      { icon: "🚃", label: "30分くらいなら", effects: { access: 3 } },
      { icon: "📖", label: "座れるなら45分でも", effects: { cost: 3, quiet: 2 } },
      { icon: "🏠", label: "リモートだから気にしない", effects: { nature: 3, cost: 3 } },
    ],
  },
  {
    id: "rent",
    title: "家賃、月いくらまで？",
    subtitle: "2LDKの目安です",
    options: [
      { icon: "💰", label: "〜12万", effects: { cost: 5 } },
      { icon: "💴", label: "〜18万", effects: {} },
      { icon: "💎", label: "〜25万", effects: {} },
      { icon: "👑", label: "気にしない", effects: {} },
    ],
  },
  {
    id: "brag",
    title: "友達に自慢したいのは？",
    options: [
      { icon: "📸", label: "映えるおしゃれな街並み", effects: { cafe: 5 } },
      { icon: "🍽️", label: "隠れた名店がある", effects: { gourmet: 5 } },
      { icon: "🏞️", label: "窓からの眺めが最高", effects: { nature: 5, quiet: 3 } },
      { icon: "🚃", label: "どこへでもすぐ行ける", effects: { access: 5 } },
    ],
  },
  {
    id: "musthave",
    title: "これだけは譲れない！",
    subtitle: "複数選べます",
    multiSelect: true,
    options: [
      { icon: "🔒", label: "治安が良い", effects: { safety: 3 } },
      { icon: "🐶", label: "ペットOK物件が多い", effects: { family: 2, nature: 2 } },
      { icon: "🏥", label: "病院が近い", effects: { safety: 2, family: 2 } },
      { icon: "🎵", label: "音が出せる環境", effects: { quiet: -2 } },
    ],
  },
  {
    id: "vibe",
    title: "二人の雰囲気を一言で？",
    options: [
      { icon: "🌟", label: "アクティブカップル", effects: { access: 3, nightlife: 3 } },
      { icon: "🌸", label: "ほっこりカップル", effects: { quiet: 4, nature: 3 } },
      { icon: "🎨", label: "こだわりカップル", effects: { cafe: 4, gourmet: 3 } },
      { icon: "⚖️", label: "バランスカップル", effects: { cafe: 1, nightlife: 1, quiet: 1, nature: 1, shopping: 1, gourmet: 1, access: 1, cost: 1, safety: 1, family: 1 } },
    ],
  },
];

// Rent filter thresholds
const RENT_LIMITS: Record<string, number> = {
  "〜12万": 120000,
  "〜18万": 180000,
  "〜25万": 250000,
  "気にしない": Infinity,
};

// Build score vector from answers
export function buildScoreVector(
  answers: Record<string, string | string[]>
): Record<ScoreKey, number> {
  const scores: Record<ScoreKey, number> = {
    cafe: 0,
    nightlife: 0,
    quiet: 0,
    nature: 0,
    family: 0,
    shopping: 0,
    gourmet: 0,
    access: 0,
    cost: 0,
    safety: 0,
  };

  for (const q of QUESTIONS) {
    const answer = answers[q.id];
    if (!answer) continue;

    const selectedLabels = Array.isArray(answer) ? answer : [answer];
    for (const label of selectedLabels) {
      const option = q.options.find((o) => o.label === label);
      if (option) {
        for (const [key, value] of Object.entries(option.effects)) {
          scores[key as ScoreKey] += value;
        }
      }
    }
  }

  return scores;
}

// Cosine similarity between two score vectors
function cosineSimilarity(
  a: Record<ScoreKey, number>,
  b: Record<ScoreKey, number>
): number {
  const keys = Object.keys(a) as ScoreKey[];
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key of keys) {
    dotProduct += a[key] * b[key];
    normA += a[key] * a[key];
    normB += b[key] * b[key];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get rent limit from answer
export function getRentLimit(answers: Record<string, string | string[]>): number {
  const rentAnswer = answers["rent"];
  if (!rentAnswer || Array.isArray(rentAnswer)) return Infinity;
  return RENT_LIMITS[rentAnswer] ?? Infinity;
}

// Score towns against user preferences
export function scoreTowns(
  towns: TownProfile[],
  userScores: Record<ScoreKey, number>,
  rentLimit: number
): { town: TownProfile; score: number }[] {
  return towns
    .filter((t) => t.rent2ldk <= rentLimit)
    .map((t) => ({
      town: t,
      score: Math.round(cosineSimilarity(userScores, t.scores) * 100),
    }))
    .sort((a, b) => b.score - a.score);
}

// Calculate compatibility between two users' answers
export function calculateCompatibility(
  answers1: Record<string, string | string[]>,
  answers2: Record<string, string | string[]>
): {
  percentage: number;
  matches: string[];
  differences: { question: string; answer1: string; answer2: string }[];
} {
  let matchCount = 0;
  const matches: string[] = [];
  const differences: { question: string; answer1: string; answer2: string }[] = [];

  for (const q of QUESTIONS) {
    const a1 = answers1[q.id];
    const a2 = answers2[q.id];
    if (!a1 || !a2) continue;

    const s1 = Array.isArray(a1) ? a1.sort().join(",") : a1;
    const s2 = Array.isArray(a2) ? a2.sort().join(",") : a2;

    if (s1 === s2) {
      matchCount++;
      matches.push(q.title);
    } else {
      differences.push({
        question: q.title,
        answer1: Array.isArray(a1) ? a1.join("・") : a1,
        answer2: Array.isArray(a2) ? a2.join("・") : a2,
      });
    }
  }

  const total = QUESTIONS.length;
  return {
    percentage: Math.round((matchCount / total) * 100),
    matches,
    differences,
  };
}

// Determine couple type label
export function getCoupleType(scores: Record<ScoreKey, number>): {
  icon: string;
  label: string;
} {
  const top = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const topKey = top[0]?.[0] as ScoreKey;

  const types: Record<string, { icon: string; label: string }> = {
    cafe: { icon: "☕", label: "おしゃれカフェカップル" },
    nightlife: { icon: "🌃", label: "シティライフカップル" },
    quiet: { icon: "🌸", label: "ほっこり癒しカップル" },
    nature: { icon: "🌿", label: "自然派ヒーリングカップル" },
    family: { icon: "🏡", label: "おうち大好きカップル" },
    shopping: { icon: "🛍️", label: "おかいものカップル" },
    gourmet: { icon: "🍽️", label: "グルメ探求カップル" },
    access: { icon: "🚃", label: "フットワーク軽めカップル" },
    cost: { icon: "💰", label: "堅実コスパカップル" },
    safety: { icon: "🔒", label: "安心安全カップル" },
  };

  return types[topKey] ?? { icon: "💕", label: "ラブラブカップル" };
}
