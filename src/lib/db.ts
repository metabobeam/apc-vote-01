import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { VoteConfig, DEFAULT_CONFIG, JudgeVoteRecord, ReviewRecord, ReviewConfig, DEFAULT_REVIEW_CONFIG, DEFAULT_CRITERIA_LABELS } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "votes.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // WALモード: 複数の読み込みと書き込みを同時処理
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("busy_timeout = 5000");

  initSchema(_db);
  runMigrations(_db);
  return _db;
}

function runMigrations(db: Database.Database) {
  // group_name カラムが存在しない場合のみ追加（既存DBへの対応）
  const cols = db.prepare("PRAGMA table_info(votes)").all() as { name: string }[];
  if (!cols.find((c) => c.name === "group_name")) {
    db.exec("ALTER TABLE votes ADD COLUMN group_name TEXT NOT NULL DEFAULT ''");
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id                TEXT PRIMARY KEY,
      employee_number   TEXT NOT NULL,
      group_name        TEXT NOT NULL DEFAULT '',
      selected_ids      TEXT NOT NULL,  -- JSON配列
      timestamp         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_votes_employee
      ON votes (employee_number);

    CREATE TABLE IF NOT EXISTS judge_votes (
      id           TEXT PRIMARY KEY,
      judge_name   TEXT NOT NULL,
      selected_id  TEXT NOT NULL,
      timestamp    TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_judge_votes_name
      ON judge_votes (judge_name);

    CREATE TABLE IF NOT EXISTS review_scores (
      id           TEXT PRIMARY KEY,
      judge_name   TEXT NOT NULL,
      product_id   TEXT NOT NULL,
      criterion1   INTEGER NOT NULL,
      criterion2   INTEGER NOT NULL,
      criterion3   INTEGER NOT NULL,
      total        INTEGER NOT NULL,
      timestamp    TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_review_judge_product
      ON review_scores (judge_name, product_id);
  `);

  // 初期設定が未登録なら挿入
  const row = db.prepare("SELECT value FROM config WHERE key = 'main'").get();
  if (!row) {
    db.prepare("INSERT INTO config (key, value) VALUES ('main', ?)").run(
      JSON.stringify(DEFAULT_CONFIG)
    );
  }
}

// ─── Config ────────────────────────────────────────────────────────────────

export function dbGetConfig(): VoteConfig {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = 'main'").get() as
    | { value: string }
    | undefined;
  if (!row) return DEFAULT_CONFIG;
  const config = JSON.parse(row.value) as VoteConfig;
  if (config.maxSelections === undefined) config.maxSelections = 1;
  if (config.judges === undefined) config.judges = [];
  if (config.groups === undefined) config.groups = [];
  if (config.groupParticipants === undefined) config.groupParticipants = {};
  return config;
}

export function dbSaveConfig(config: VoteConfig): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO config (key, value) VALUES ('main', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(config));
}

// ─── Votes ─────────────────────────────────────────────────────────────────

export interface VoteRow {
  id: string;
  employeeNumber: string;
  groupName: string;
  selectedProductIds: string[];
  timestamp: string;
}

export function dbGetVotes(): VoteRow[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM votes ORDER BY timestamp DESC").all() as {
    id: string;
    employee_number: string;
    group_name: string;
    selected_ids: string;
    timestamp: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    employeeNumber: r.employee_number,
    groupName: r.group_name ?? "",
    selectedProductIds: JSON.parse(r.selected_ids) as string[],
    timestamp: r.timestamp,
  }));
}

export function dbHasEmployeeVoted(employeeNumber: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM votes WHERE employee_number = ? LIMIT 1")
    .get(employeeNumber);
  return !!row;
}

/**
 * トランザクション内で重複チェック → 投票保存を原子的に実行
 * 同時リクエストでも重複投票が入らない
 */
export function dbSaveVote(vote: VoteRow): { ok: boolean; error?: string } {
  const db = getDb();

  const saveTransaction = db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM votes WHERE employee_number = ? LIMIT 1")
      .get(vote.employeeNumber);
    if (existing) return { ok: false, error: "この社員番号はすでに投票済みです" };

    db.prepare(
      "INSERT INTO votes (id, employee_number, group_name, selected_ids, timestamp) VALUES (?, ?, ?, ?, ?)"
    ).run(
      vote.id,
      vote.employeeNumber,
      vote.groupName ?? "",
      JSON.stringify(vote.selectedProductIds),
      vote.timestamp
    );
    return { ok: true };
  });

  return saveTransaction() as { ok: boolean; error?: string };
}

export function dbDeleteVote(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM votes WHERE id = ?").run(id);
  return result.changes > 0;
}

export function dbClearVotes(): void {
  const db = getDb();
  db.prepare("DELETE FROM votes").run();
}

// ─── Judge Votes ────────────────────────────────────────────────────────────

export function dbGetJudgeVotes(): JudgeVoteRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM judge_votes ORDER BY timestamp ASC").all() as {
    id: string; judge_name: string; selected_id: string; timestamp: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    judgeName: r.judge_name,
    selectedProductId: r.selected_id,
    timestamp: r.timestamp,
  }));
}

export function dbHasJudgeVoted(judgeName: string): boolean {
  const db = getDb();
  return !!db.prepare("SELECT id FROM judge_votes WHERE judge_name = ? LIMIT 1").get(judgeName);
}

export function dbSaveJudgeVote(vote: JudgeVoteRecord): { ok: boolean; error?: string } {
  const db = getDb();
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM judge_votes WHERE judge_name = ? LIMIT 1").get(vote.judgeName);
    if (existing) return { ok: false, error: "この審査員はすでに投票済みです" };
    db.prepare(
      "INSERT INTO judge_votes (id, judge_name, selected_id, timestamp) VALUES (?, ?, ?, ?)"
    ).run(vote.id, vote.judgeName, vote.selectedProductId, vote.timestamp);
    return { ok: true };
  });
  return tx() as { ok: boolean; error?: string };
}

export function dbDeleteJudgeVote(id: string): boolean {
  const db = getDb();
  return db.prepare("DELETE FROM judge_votes WHERE id = ?").run(id).changes > 0;
}

export function dbClearJudgeVotes(): void {
  const db = getDb();
  db.prepare("DELETE FROM judge_votes").run();
}

// ─── Review Config（討議班審査設定） ────────────────────────────────────────

export function dbGetReviewConfig(): ReviewConfig {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = 'review'").get() as
    | { value: string }
    | undefined;
  if (!row) return { ...DEFAULT_REVIEW_CONFIG, criteriaLabels: [...DEFAULT_CRITERIA_LABELS] };
  try {
    const cfg = JSON.parse(row.value) as ReviewConfig;
    if (!cfg.criteriaLabels || cfg.criteriaLabels.length !== 3) {
      cfg.criteriaLabels = [...DEFAULT_CRITERIA_LABELS];
    }
    return cfg;
  } catch {
    return { ...DEFAULT_REVIEW_CONFIG, criteriaLabels: [...DEFAULT_CRITERIA_LABELS] };
  }
}

export function dbSaveReviewConfig(cfg: ReviewConfig): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO config (key, value) VALUES ('review', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(cfg));
}

// ─── Review Scores ───────────────────────────────────────────────────────────

export function dbGetReviewScores(): ReviewRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM review_scores ORDER BY timestamp ASC").all() as {
    id: string; judge_name: string; product_id: string;
    criterion1: number; criterion2: number; criterion3: number;
    total: number; timestamp: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    judgeName: r.judge_name,
    productId: r.product_id,
    criterion1: r.criterion1,
    criterion2: r.criterion2,
    criterion3: r.criterion3,
    total: r.total,
    timestamp: r.timestamp,
  }));
}

export function dbGetReviewByJudge(judgeName: string): ReviewRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM review_scores WHERE judge_name = ?").all(judgeName) as {
    id: string; judge_name: string; product_id: string;
    criterion1: number; criterion2: number; criterion3: number;
    total: number; timestamp: string;
  }[];
  return rows.map((r) => ({
    id: r.id, judgeName: r.judge_name, productId: r.product_id,
    criterion1: r.criterion1, criterion2: r.criterion2, criterion3: r.criterion3,
    total: r.total, timestamp: r.timestamp,
  }));
}

export function dbSaveReviewScore(rec: ReviewRecord): { ok: boolean; error?: string } {
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO review_scores (id, judge_name, product_id, criterion1, criterion2, criterion3, total, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(judge_name, product_id) DO UPDATE SET
         criterion1=excluded.criterion1, criterion2=excluded.criterion2,
         criterion3=excluded.criterion3, total=excluded.total, timestamp=excluded.timestamp`
    ).run(rec.id, rec.judgeName, rec.productId, rec.criterion1, rec.criterion2, rec.criterion3, rec.total, rec.timestamp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function dbDeleteReviewScore(id: string): boolean {
  const db = getDb();
  return db.prepare("DELETE FROM review_scores WHERE id = ?").run(id).changes > 0;
}

export function dbClearReviewScores(): void {
  const db = getDb();
  db.prepare("DELETE FROM review_scores").run();
}

export function dbClearReviewByJudge(judgeName: string): void {
  const db = getDb();
  db.prepare("DELETE FROM review_scores WHERE judge_name = ?").run(judgeName);
}
