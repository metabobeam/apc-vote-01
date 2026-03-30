import fs from "fs";
import path from "path";
import { Vote, VoteConfig, DEFAULT_CONFIG } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const VOTES_FILE = path.join(DATA_DIR, "votes.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getConfig(): VoteConfig {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
  const config = JSON.parse(raw) as VoteConfig;
  // 旧データ互換: maxSelectionsがない場合は1をデフォルトに
  if (config.maxSelections === undefined) {
    config.maxSelections = 1;
  }
  return config;
}

export function saveConfig(config: VoteConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getVotes(): Vote[] {
  ensureDataDir();
  if (!fs.existsSync(VOTES_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(VOTES_FILE, "utf-8");
  const votes = JSON.parse(raw) as Vote[];
  // 旧データ互換: selectedProductIdがある場合はselectedProductIdsに変換
  return votes.map((v) => {
    if (!v.selectedProductIds) {
      const legacy = v as Vote & { selectedProductId?: string };
      return { ...v, selectedProductIds: legacy.selectedProductId ? [legacy.selectedProductId] : [] };
    }
    return v;
  });
}

export function saveVote(vote: Vote): void {
  ensureDataDir();
  const votes = getVotes();
  votes.push(vote);
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2), "utf-8");
}

export function hasEmployeeVoted(employeeNumber: string): boolean {
  const votes = getVotes();
  return votes.some((v) => v.employeeNumber === employeeNumber);
}

export function deleteVoteById(id: string): boolean {
  const votes = getVotes();
  const next = votes.filter((v) => v.id !== id);
  if (next.length === votes.length) return false; // 該当なし
  fs.writeFileSync(VOTES_FILE, JSON.stringify(next, null, 2), "utf-8");
  return true;
}

export function clearVotes(): void {
  ensureDataDir();
  fs.writeFileSync(VOTES_FILE, JSON.stringify([], null, 2), "utf-8");
}
