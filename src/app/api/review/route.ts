import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  dbGetConfig,
  dbGetReviewConfig,
  dbSaveReviewConfig,
  dbGetReviewScores,
  dbSaveReviewScore,
  dbDeleteReviewScore,
  dbClearReviewScores,
  dbClearReviewByJudge,
} from "@/lib/db";
import { ReviewResult, ReviewTarget } from "@/lib/types";

// GET: 討議班設定・審査員・採点結果を取得
export async function GET() {
  try {
    const voteConfig = dbGetConfig();
    const reviewConfig = dbGetReviewConfig();
    const scores = dbGetReviewScores();
    const targets = reviewConfig.targets;

    // 班ごとに集計
    const results: ReviewResult[] = targets.map((t) => {
      const tScores = scores.filter((s) => s.productId === t.id);
      const totalScore = tScores.reduce((sum, s) => sum + s.total, 0);
      return {
        productId: t.id,
        productNumber: t.name,
        description: t.name,
        totalScore,
        avgScore: tScores.length > 0 ? Math.round((totalScore / tScores.length) * 10) / 10 : 0,
        reviewCount: tScores.length,
        scores: tScores.map((s) => ({
          judgeName: s.judgeName,
          criterion1: s.criterion1,
          criterion2: s.criterion2,
          criterion3: s.criterion3,
          total: s.total,
        })),
      };
    });

    // 審査員ごとの入力済み班IDリスト
    const judgeProgress: Record<string, string[]> = {};
    // 審査員×班ごとのスコア詳細 judgeName -> targetId -> {criterion1, criterion2, criterion3}
    const judgeScores: Record<string, Record<string, { criterion1: number; criterion2: number; criterion3: number }>> = {};
    for (const s of scores) {
      if (!judgeProgress[s.judgeName]) judgeProgress[s.judgeName] = [];
      judgeProgress[s.judgeName].push(s.productId);

      if (!judgeScores[s.judgeName]) judgeScores[s.judgeName] = {};
      judgeScores[s.judgeName][s.productId] = {
        criterion1: s.criterion1,
        criterion2: s.criterion2,
        criterion3: s.criterion3,
      };
    }

    return NextResponse.json({
      judges: voteConfig.judges ?? [],
      targets,
      criteriaLabels: reviewConfig.criteriaLabels,
      results,
      judgeProgress,
      judgeScores,
    });
  } catch {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// PUT: 討議班リスト or 項目名を更新（管理画面から）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, targets, criteriaLabels } = body as {
      password: string;
      targets?: ReviewTarget[];
      criteriaLabels?: [string, string, string];
    };

    const config = dbGetConfig();
    if (password !== config.adminPassword) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }

    const current = dbGetReviewConfig();
    dbSaveReviewConfig({
      targets: targets ?? current.targets,
      criteriaLabels: criteriaLabels ?? current.criteriaLabels,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

// POST: 採点を保存（審査員 × 班ごと、上書き可）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { judgeName, scores } = body as {
      judgeName: string;
      scores: { productId: string; criterion1: number; criterion2: number; criterion3: number }[];
    };

    if (!judgeName || !Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json({ error: "入力データが不正です" }, { status: 400 });
    }

    const voteConfig = dbGetConfig();
    if (!(voteConfig.judges ?? []).includes(judgeName)) {
      return NextResponse.json({ error: "無効な審査員名です" }, { status: 400 });
    }

    for (const s of scores) {
      if (s.criterion1 < 1 || s.criterion1 > 5 ||
          s.criterion2 < 1 || s.criterion2 > 5 ||
          s.criterion3 < 1 || s.criterion3 > 5) {
        return NextResponse.json({ error: "点数は1〜5の範囲で入力してください" }, { status: 400 });
      }
      const result = dbSaveReviewScore({
        id: uuidv4(),
        judgeName,
        productId: s.productId,
        criterion1: s.criterion1,
        criterion2: s.criterion2,
        criterion3: s.criterion3,
        total: s.criterion1 + s.criterion2 + s.criterion3,
        timestamp: new Date().toISOString(),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "保存エラー" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

// DELETE: 審査員の採点リセット or 全削除（パスワード必須）
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { judgeName, clearAll, password } = body as {
      judgeName?: string;
      clearAll?: boolean;
      password?: string;
    };

    const config = dbGetConfig();
    if (password !== config.adminPassword) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }

    if (clearAll) {
      dbClearReviewScores();
      return NextResponse.json({ success: true });
    }
    if (judgeName) {
      dbClearReviewByJudge(judgeName);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "judgeNameまたはclearAllが必要です" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
