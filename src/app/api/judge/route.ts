import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { dbGetConfig, dbGetVotes, dbGetJudgeVotes, dbSaveJudgeVote, dbDeleteJudgeVote, dbClearJudgeVotes } from "@/lib/db";
import { JudgeResult } from "@/lib/types";

// 社員投票の上位候補を取得（1位・2位、同点含む）
function getTopCandidates() {
  const config = dbGetConfig();
  const votes = dbGetVotes();

  // 重複排除（最新1票/社員）
  const validVotesMap = new Map<string, typeof votes[0]>();
  for (const v of votes) {
    const ex = validVotesMap.get(v.employeeNumber);
    if (!ex || v.timestamp > ex.timestamp) validVotesMap.set(v.employeeNumber, v);
  }
  const validVotes = Array.from(validVotesMap.values());

  const counts = config.options.map((opt) => ({
    productId: opt.id,
    productNumber: opt.productNumber,
    description: opt.description,
    count: validVotes.filter((v) => v.selectedProductIds.includes(opt.id)).length,
  }));

  if (counts.length === 0) return [];

  const sorted = [...counts].sort((a, b) => b.count - a.count);
  const rank1Count = sorted[0].count;
  const rank2Count = sorted.find((c) => c.count < rank1Count)?.count ?? -1;

  return sorted.filter((c) => c.count === rank1Count || (rank2Count > 0 && c.count === rank2Count));
}

export async function GET() {
  try {
    const config = dbGetConfig();
    const judgeVotes = dbGetJudgeVotes();
    const candidates = getTopCandidates();

    // 審査員投票の集計
    const results: JudgeResult[] = config.options.map((opt) => ({
      productId: opt.id,
      productNumber: opt.productNumber,
      description: opt.description,
      judgeVoteCount: judgeVotes.filter((jv) => jv.selectedProductId === opt.id).length,
    })).filter((r) => r.judgeVoteCount > 0 || candidates.some((c) => c.productId === r.productId));

    return NextResponse.json({
      judges: config.judges ?? [],
      candidates,
      judgeVotes: judgeVotes.map((jv) => ({ id: jv.id, judgeName: jv.judgeName, selectedProductId: jv.selectedProductId })),
      results,
    });
  } catch {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { judgeName, selectedProductId } = body as { judgeName: string; selectedProductId: string };

    if (!judgeName || !selectedProductId) {
      return NextResponse.json({ error: "審査員名と選択作品は必須です" }, { status: 400 });
    }

    const config = dbGetConfig();
    if (!(config.judges ?? []).includes(judgeName)) {
      return NextResponse.json({ error: "無効な審査員名です" }, { status: 400 });
    }
    if (!config.options.find((o) => o.id === selectedProductId)) {
      return NextResponse.json({ error: "無効な作品IDです" }, { status: 400 });
    }

    const result = dbSaveJudgeVote({
      id: uuidv4(),
      judgeName,
      selectedProductId,
      timestamp: new Date().toISOString(),
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "投票に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, clearAll, password } = body as { id?: string; clearAll?: boolean; password?: string };

    const config = dbGetConfig();

    // clearAll はパスワード必須
    if (clearAll) {
      if (password !== config.adminPassword) {
        return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
      }
      dbClearJudgeVotes();
      return NextResponse.json({ success: true });
    }

    // 個別取り消しはパスワード不要（投票入力担当者が操作）
    if (id) {
      const deleted = dbDeleteJudgeVote(id);
      if (!deleted) return NextResponse.json({ error: "該当データが見つかりません" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "idまたはclearAllが必要です" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
