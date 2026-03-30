import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getConfig, saveVote, hasEmployeeVoted } from "@/lib/store";
import { Vote } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeNumber, selectedProductIds } = body as {
      employeeNumber: string;
      selectedProductIds: string[];
    };

    if (!employeeNumber || !selectedProductIds || !Array.isArray(selectedProductIds)) {
      return NextResponse.json(
        { error: "社員番号と選択作品は必須です" },
        { status: 400 }
      );
    }

    const config = getConfig();

    if (!config.isActive) {
      return NextResponse.json({ error: "投票は現在受け付けていません" }, { status: 403 });
    }

    const now = new Date();
    const deadline = new Date(config.deadline);
    if (now > deadline) {
      return NextResponse.json({ error: "投票の締め切りを過ぎています" }, { status: 403 });
    }

    const maxSel = config.maxSelections ?? 1;
    if (selectedProductIds.length !== maxSel) {
      return NextResponse.json(
        { error: `${maxSel}つの作品を選択してください` },
        { status: 400 }
      );
    }

    // 全選択IDが有効か確認
    for (const id of selectedProductIds) {
      const valid = config.options.find((o) => o.id === id);
      if (!valid) {
        return NextResponse.json({ error: "無効な選択肢が含まれています" }, { status: 400 });
      }
    }

    // 重複チェック
    const unique = new Set(selectedProductIds);
    if (unique.size !== selectedProductIds.length) {
      return NextResponse.json({ error: "同じ作品を重複して選択できません" }, { status: 400 });
    }

    if (hasEmployeeVoted(employeeNumber)) {
      return NextResponse.json(
        { error: "この社員番号はすでに投票済みです" },
        { status: 409 }
      );
    }

    const vote: Vote = {
      id: uuidv4(),
      employeeNumber,
      selectedProductIds,
      timestamp: new Date().toISOString(),
    };

    saveVote(vote);

    return NextResponse.json({ success: true, message: "投票が完了しました" });
  } catch {
    return NextResponse.json({ error: "投票の処理に失敗しました" }, { status: 500 });
  }
}
