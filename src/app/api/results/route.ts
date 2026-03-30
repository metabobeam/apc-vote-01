import { NextRequest, NextResponse } from "next/server";
import { getConfig, getVotes, clearVotes } from "@/lib/store";
import { VoteStats } from "@/lib/types";

export async function GET() {
  try {
    const config = getConfig();
    const votes = getVotes();

    const results = config.options.map((option) => {
      // 各投票の selectedProductIds に含まれる数をカウント
      const count = votes.filter((v) =>
        v.selectedProductIds.includes(option.id)
      ).length;
      const percentage = votes.length > 0
        ? Math.round((count / votes.length) * 100)
        : 0;
      return {
        productId: option.id,
        productNumber: option.productNumber,
        description: option.description,
        count,
        percentage,
      };
    });

    results.sort((a, b) => b.count - a.count);

    const stats: VoteStats = {
      totalVotes: votes.length,
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

    const config = getConfig();
    if (password !== config.adminPassword) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }

    clearVotes();
    return NextResponse.json({ success: true, message: "投票データをリセットしました" });
  } catch {
    return NextResponse.json({ error: "リセットに失敗しました" }, { status: 500 });
  }
}
