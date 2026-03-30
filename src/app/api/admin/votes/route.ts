import { NextRequest, NextResponse } from "next/server";
import { getConfig, getVotes, deleteVoteById } from "@/lib/store";

/** 全投票一覧を取得 */
export async function GET() {
  try {
    const config = getConfig();
    const votes = getVotes();

    const countByEmployee = votes.reduce<Record<string, number>>((acc, v) => {
      acc[v.employeeNumber] = (acc[v.employeeNumber] ?? 0) + 1;
      return acc;
    }, {});

    const result = votes.map((v) => ({
      id: v.id,
      employeeNumber: v.employeeNumber,
      productNumbers: v.selectedProductIds.map(
        (pid) => config.options.find((o) => o.id === pid)?.productNumber ?? pid
      ),
      timestamp: v.timestamp,
      isDuplicate: (countByEmployee[v.employeeNumber] ?? 0) > 1,
    }));

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ votes: result, total: result.length });
  } catch {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

/** 指定IDの投票を削除 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body as { id: string };
    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }
    const deleted = deleteVoteById(id);
    if (!deleted) {
      return NextResponse.json({ error: "該当する投票が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
