import { NextRequest, NextResponse } from "next/server";
import { dbGetConfig, dbGetVotes, dbClearVotes } from "@/lib/db";
import { VoteStats } from "@/lib/types";

export async function GET() {
  try {
    const config = dbGetConfig();
    const votes = dbGetVotes();

    // 同一社員の重複投票は最新の1件のみ有効とする
    const validVotesMap = new Map<string, typeof votes[0]>();
    for (const v of votes) {
      const existing = validVotesMap.get(v.employeeNumber);
      if (!existing || v.timestamp > existing.timestamp) {
        validVotesMap.set(v.employeeNumber, v);
      }
    }
    const validVotes = Array.from(validVotesMap.values());

    const rawResults = config.options.map((option) => {
      const count = validVotes.filter((v) => v.selectedProductIds.includes(option.id)).length;
      return { productId: option.id, productNumber: option.productNumber, description: option.description, count, percentage: 0 };
    });

    // 総票数 = 有効投票者数 × 1人あたりの選択数（12人×2票=24）
    const maxSel = config.maxSelections ?? 1;
    const totalVotes = validVotes.length * maxSel;

    const results = rawResults.map((r) => ({
      ...r,
      percentage: totalVotes > 0 ? Math.round((r.count / totalVotes) * 100) : 0,
    }));
    results.sort((a, b) => b.count - a.count);

    // 投票人数（有効投票者数）
    const voterCount = validVotes.length;

    // 班ごとの投票人数
    const groupMap = new Map<string, number>();
    for (const v of validVotes) {
      const g = v.groupName?.trim() || "未設定";
      groupMap.set(g, (groupMap.get(g) ?? 0) + 1);
    }
    const votersByGroup = Array.from(groupMap.entries())
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => a.group.localeCompare(b.group, "ja"));

    const stats: VoteStats = {
      totalVotes,
      voterCount,
      votersByGroup,
      maxSelections: config.maxSelections ?? 1,
      results,
      lastUpdated: new Date().toISOString(),
    };
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "結果の取得に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;
    const config = dbGetConfig();
    if (password !== config.adminPassword) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }
    dbClearVotes();
    return NextResponse.json({ success: true, message: "投票データをリセットしました" });
  } catch {
    return NextResponse.json({ error: "リセットに失敗しました" }, { status: 500 });
  }
}
