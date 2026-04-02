import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { dbGetConfig, dbSaveVote } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeNumber, groupName, selectedProductIds } = body as {
      employeeNumber: string;
      groupName: string;
      selectedProductIds: string[];
    };

    if (!employeeNumber || !groupName || !selectedProductIds || !Array.isArray(selectedProductIds)) {
      return NextResponse.json({ error: "社員番号・所属組・選択作品は必須です" }, { status: 400 });
    }

    const config = dbGetConfig();

    if (!config.isActive) {
      return NextResponse.json({ error: "投票は現在受け付けていません" }, { status: 403 });
    }
    if (new Date() > new Date(config.deadline)) {
      return NextResponse.json({ error: "投票の締め切りを過ぎています" }, { status: 403 });
    }

    const maxSel = config.maxSelections ?? 1;
    if (selectedProductIds.length !== maxSel) {
      return NextResponse.json({ error: `${maxSel}つの作品を選択してください` }, { status: 400 });
    }
    for (const id of selectedProductIds) {
      if (!config.options.find((o) => o.id === id)) {
        return NextResponse.json({ error: "無効な選択肢が含まれています" }, { status: 400 });
      }
    }
    if (new Set(selectedProductIds).size !== selectedProductIds.length) {
      return NextResponse.json({ error: "同じ作品を重複して選択できません" }, { status: 400 });
    }

    // トランザクションで重複チェック＋保存（競合状態を防止）
    const result = dbSaveVote({
      id: uuidv4(),
      employeeNumber,
      groupName: groupName ?? "",
      selectedProductIds,
      timestamp: new Date().toISOString(),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ success: true, message: "投票が完了しました" });
  } catch {
    return NextResponse.json({ error: "投票の処理に失敗しました" }, { status: 500 });
  }
}
