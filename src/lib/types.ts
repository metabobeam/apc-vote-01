export interface ProductOption {
  id: string;
  productNumber: string;
  description: string;
}

export interface VoteConfig {
  title: string;
  deadline: string; // ISO 8601 string
  options: ProductOption[];
  isActive: boolean;
  adminPassword: string;
  maxSelections: number; // 1, 2, or 3
  judges: string[]; // 審査員名リスト
  groups: string[]; // 組リスト
  groupParticipants: Record<string, number>; // 組ごとの参加人数
}

export interface JudgeVoteRecord {
  id: string;
  judgeName: string;
  selectedProductId: string;
  timestamp: string;
}

export interface JudgeResult {
  productId: string;
  productNumber: string;
  description: string;
  judgeVoteCount: number;
}

export interface Vote {
  id: string;
  employeeNumber: string;
  selectedProductIds: string[]; // 複数選択対応
  timestamp: string;
}

export interface VoteResult {
  productId: string;
  productNumber: string;
  description: string;
  count: number;
  percentage: number;
}

export interface VoteStats {
  totalVotes: number;
  voterCount: number;                          // 投票人数（重複除外）
  votersByGroup: { group: string; count: number }[]; // 班ごとの投票人数
  recentVotes: { id: string; employeeNumber: string; groupName: string; timestamp: string }[]; // ダッシュボード用直近投票
  maxSelections: number;
  results: VoteResult[];
  lastUpdated: string;
}

export interface DashboardStat {
  group: string;
  voted: number;
  total: number;  // 参加人数（0=未設定）
}

// ─── 討議班審査（投票と独立） ─────────────────────────────────────────────

/** 討議班審査の対象（班・グループ） */
export interface ReviewTarget {
  id: string;
  name: string; // 班名
}

/** 討議班審査の設定（投票設定とは別管理） */
export interface ReviewConfig {
  targets: ReviewTarget[];
  criteriaLabels: [string, string, string]; // 項目1〜3のラベル
}

export const DEFAULT_CRITERIA_LABELS: [string, string, string] = [
  "創業の精神・理念・価値基準・行動規範との結びつけ",
  "表面的な結論で終わらず、考えを掘り下げた痕跡",
  "回答の中に、新しい視点・立場・考え方が併記されているか",
];

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  targets: [],
  criteriaLabels: [...DEFAULT_CRITERIA_LABELS],
};

export interface ReviewRecord {
  id: string;
  judgeName: string;
  productId: string;
  criterion1: number; // 1〜5
  criterion2: number;
  criterion3: number;
  total: number;      // 合計
  timestamp: string;
}

export interface ReviewResult {
  productId: string;
  productNumber: string;
  description: string;
  totalScore: number;
  avgScore: number;
  reviewCount: number;
  scores: { judgeName: string; criterion1: number; criterion2: number; criterion3: number; total: number }[];
}

export const DEFAULT_CONFIG: VoteConfig = {
  title: "優秀作品投票",
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  options: [
    { id: "1", productNumber: "A-001", description: "作品 A-001" },
    { id: "2", productNumber: "A-002", description: "作品 A-002" },
  ],
  isActive: true,
  adminPassword: "admin1234",
  maxSelections: 1,
  judges: [],
  groups: [],
  groupParticipants: {},
};
