import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { VoteConfig, DEFAULT_CONFIG } from "./types";

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
  return _db;
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
      selected_ids      TEXT NOT NULL,  -- JSON配列
      timestamp         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_votes_employee
      ON votes (employee_number);
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
  selectedProductIds: string[];
  timestamp: string;
}

export function dbGetVotes(): VoteRow[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM votes ORDER BY timestamp DESC").all() as {
    id: string;
    employee_number: string;
    selected_ids: string;
    timestamp: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    employeeNumber: r.employee_number,
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
      "INSERT INTO votes (id, employee_number, selected_ids, timestamp) VALUES (?, ?, ?, ?)"
    ).run(
      vote.id,
      vote.employeeNumber,
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
