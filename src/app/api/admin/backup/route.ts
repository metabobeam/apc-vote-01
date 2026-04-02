import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET: 全データをJSONでダウンロード
export async function GET() {
  try {
    const db = getDb();

    const config = db.prepare("SELECT key, value FROM config").all() as { key: string; value: string }[];
    const votes = db.prepare("SELECT * FROM votes ORDER BY timestamp ASC").all();
    const judgeVotes = db.prepare("SELECT * FROM judge_votes ORDER BY timestamp ASC").all();
    const reviewScores = db.prepare("SELECT * FROM review_scores ORDER BY timestamp ASC").all();

    const backup = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: { config, votes, judgeVotes, reviewScores },
    };

    const json = JSON.stringify(backup, null, 2);
    const filename = `apc-vote-backup-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: JSONをアップロードして全データを復元
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      version: number;
      data: {
        config: { key: string; value: string }[];
        votes: Record<string, unknown>[];
        judgeVotes: Record<string, unknown>[];
        reviewScores: Record<string, unknown>[];
      };
    };

    if (!body?.data) {
      return NextResponse.json({ error: "不正なバックアップファイルです" }, { status: 400 });
    }

    const db = getDb();
    const { config, votes, judgeVotes, reviewScores } = body.data;

    const restore = db.transaction(() => {
      // config
      db.prepare("DELETE FROM config").run();
      for (const row of config ?? []) {
        db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run(row.key, row.value);
      }

      // votes
      db.prepare("DELETE FROM votes").run();
      for (const row of votes ?? []) {
        db.prepare(
          "INSERT INTO votes (id, employee_number, group_name, selected_ids, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).run(row.id, row.employee_number, row.group_name ?? "", row.selected_ids, row.timestamp);
      }

      // judge_votes
      db.prepare("DELETE FROM judge_votes").run();
      for (const row of judgeVotes ?? []) {
        db.prepare(
          "INSERT INTO judge_votes (id, judge_name, selected_id, timestamp) VALUES (?, ?, ?, ?)"
        ).run(row.id, row.judge_name, row.selected_id, row.timestamp);
      }

      // review_scores
      db.prepare("DELETE FROM review_scores").run();
      for (const row of reviewScores ?? []) {
        db.prepare(
          "INSERT INTO review_scores (id, judge_name, product_id, criterion1, criterion2, criterion3, total, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          row.id, row.judge_name, row.product_id,
          row.criterion1, row.criterion2, row.criterion3, row.total,
          row.timestamp
        );
      }
    });

    restore();

    return NextResponse.json({
      ok: true,
      restored: {
        config: config?.length ?? 0,
        votes: votes?.length ?? 0,
        judgeVotes: judgeVotes?.length ?? 0,
        reviewScores: reviewScores?.length ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
