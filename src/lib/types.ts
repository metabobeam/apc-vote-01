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
  maxSelections: number;
  results: VoteResult[];
  lastUpdated: string;
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
};
