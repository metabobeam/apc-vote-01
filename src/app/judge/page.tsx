"use client";

import { useEffect, useState, useCallback } from "react";

interface Candidate {
  productId: string;
  productNumber: string;
  description: string;
  count: number;
}

interface JudgeData {
  judges: string[];
  candidates: Candidate[];
  judgeVotes: { id: string; judgeName: string; selectedProductId: string }[];
}

export default function JudgePage() {
  const [data, setData] = useState<JudgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [cancelingJudge, setCancelingJudge] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/judge");
      if (res.ok) {
        const json: JudgeData = await res.json();
        setData(json);
        const initial: Record<string, string> = {};
        for (const jv of json.judgeVotes) {
          initial[jv.judgeName] = jv.selectedProductId;
        }
        setSelections(initial);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const alreadyVoted = (judgeName: string) =>
    data?.judgeVotes.some((jv) => jv.judgeName === judgeName) ?? false;

  const handleSelect = (judgeName: string, productId: string) => {
    if (alreadyVoted(judgeName)) return;
    setSelections((prev) => ({ ...prev, [judgeName]: productId }));
    setErrors((prev) => { const n = { ...prev }; delete n[judgeName]; return n; });
    setSuccessMsg("");
  };

  const handleSubmitAll = async () => {
    if (!data) return;
    const newErrors: Record<string, string> = {};
    const unvoted = data.judges.filter((j) => !alreadyVoted(j));
    for (const judge of unvoted) {
      if (!selections[judge]) newErrors[judge] = "選択してください";
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    setErrors({});
    let failCount = 0;
    for (const judge of unvoted) {
      try {
        const res = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ judgeName: judge, selectedProductId: selections[judge] }),
        });
        if (!res.ok) {
          const json = await res.json();
          setErrors((prev) => ({ ...prev, [judge]: json.error ?? "投票に失敗" }));
          failCount++;
        }
      } catch {
        setErrors((prev) => ({ ...prev, [judge]: "通信エラー" }));
        failCount++;
      }
    }
    setSubmitting(false);
    if (failCount === 0) { setSuccessMsg("✅ 全員の投票を保存しました"); fetchData(); }
  };

  const handleCancel = async (judgeName: string) => {
    const jv = data?.judgeVotes.find((v) => v.judgeName === judgeName);
    if (!jv) return;
    setCancelingJudge(judgeName);
    try {
      const res = await fetch("/api/judge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jv.id }),
      });
      if (res.ok) {
        setSuccessMsg("");
        setSelections((prev) => { const n = { ...prev }; delete n[judgeName]; return n; });
        fetchData();
      }
    } finally {
      setCancelingJudge(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">読み込み中...</div>
      </main>
    );
  }

  if (!data || data.judges.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 text-sm">審査員が登録されていません</p>
          <p className="text-gray-400 text-xs mt-2">管理画面で審査員を登録してください</p>
        </div>
      </main>
    );
  }

  const unvotedCount = data.judges.filter((j) => !alreadyVoted(j)).length;
  const votedCount = data.judges.length - unvotedCount;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-4xl">

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-1">審査員投票</h1>
          <p className="text-gray-500 text-sm">
            投票済み {votedCount} / {data.judges.length} 名
          </p>
          {/* 進捗バー */}
          <div className="mt-3 mx-auto w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${data.judges.length > 0 ? (votedCount / data.judges.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* 成功メッセージ */}
        {successMsg && (
          <div className="mb-5 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-xl px-5 py-3 text-center text-sm font-semibold shadow-sm">
            {successMsg}
          </div>
        )}

        {/* テーブルカード */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

          {/* テーブルヘッダー */}
          <div
            className="hidden sm:grid bg-gray-100 border-b border-gray-200 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider"
            style={{ gridTemplateColumns: `200px repeat(${data.candidates.length}, 1fr) 100px` }}
          >
            <span>審査員</span>
            {data.candidates.map((c) => (
              <span key={c.productId} className="text-center text-gray-700">
                {c.productNumber.split("\n")[0]}
              </span>
            ))}
            <span className="text-center">状態</span>
          </div>

          {/* 審査員行 */}
          <div className="divide-y divide-gray-100">
            {data.judges.map((judge, idx) => {
              const voted = alreadyVoted(judge);
              const votedProductId = data.judgeVotes.find((jv) => jv.judgeName === judge)?.selectedProductId;
              const hasError = !!errors[judge];

              return (
                <div
                  key={judge}
                  className={`transition-colors ${
                    voted
                      ? "bg-emerald-50/50"
                      : hasError
                        ? "bg-red-50"
                        : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  {/* PC: 横グリッド */}
                  <div
                    className="hidden sm:grid items-center px-6 py-4 gap-2"
                    style={{ gridTemplateColumns: `200px repeat(${data.candidates.length}, 1fr) 100px` }}
                  >
                    {/* 審査員名 */}
                    <div>
                      <p className={`font-bold text-base ${voted ? "text-gray-500" : "text-gray-800"}`}>
                        {judge}
                      </p>
                      {hasError && (
                        <p className="text-red-500 text-xs mt-0.5">{errors[judge]}</p>
                      )}
                    </div>

                    {/* 候補選択 */}
                    {data.candidates.map((c) => {
                      const isSelected = (voted ? votedProductId : selections[judge]) === c.productId;
                      return (
                        <div key={c.productId} className="flex justify-center">
                          <button
                            onClick={() => handleSelect(judge, c.productId)}
                            disabled={voted}
                            title={c.productNumber.split("\n")[0]}
                            className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all focus:outline-none ${
                              isSelected
                                ? voted
                                  ? "bg-emerald-500 border-emerald-500 shadow-md"
                                  : "bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-200"
                                : voted
                                  ? "border-gray-200 bg-gray-100 cursor-default"
                                  : "border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer"
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {/* 状態バッジ・取り消し */}
                    <div className="flex flex-col items-center gap-1.5">
                      {voted ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full">
                            ✓ 投票済み
                          </span>
                          <button
                            onClick={() => handleCancel(judge)}
                            disabled={cancelingJudge === judge}
                            className="text-xs text-rose-400 hover:text-rose-600 hover:underline transition-colors disabled:opacity-50"
                          >
                            {cancelingJudge === judge ? "取り消し中..." : "取り消す"}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">未投票</span>
                      )}
                    </div>
                  </div>

                  {/* スマホ: 縦レイアウト */}
                  <div className="flex flex-col sm:hidden px-4 py-4 gap-3">
                    <div className="flex items-center justify-between">
                      <p className={`font-bold text-base ${voted ? "text-gray-500" : "text-gray-800"}`}>{judge}</p>
                      {voted ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">✓ 投票済み</span>
                          <button
                            onClick={() => handleCancel(judge)}
                            disabled={cancelingJudge === judge}
                            className="text-xs text-rose-400 hover:text-rose-600 hover:underline transition-colors disabled:opacity-50"
                          >
                            {cancelingJudge === judge ? "取り消し中..." : "取り消す"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">未投票</span>
                      )}
                    </div>
                    {hasError && <p className="text-red-500 text-xs -mt-1">{errors[judge]}</p>}
                    <div className="flex flex-col gap-2">
                      {data.candidates.map((c) => {
                        const isSelected = (voted ? votedProductId : selections[judge]) === c.productId;
                        return (
                          <button
                            key={c.productId}
                            onClick={() => handleSelect(judge, c.productId)}
                            disabled={voted}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? voted
                                  ? "bg-emerald-50 border-emerald-400"
                                  : "bg-indigo-50 border-indigo-500"
                                : "bg-white border-gray-200 hover:border-indigo-300"
                            } ${voted ? "cursor-default" : "cursor-pointer"}`}
                          >
                            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected
                                ? voted ? "bg-emerald-500 border-emerald-500" : "bg-indigo-600 border-indigo-600"
                                : "border-gray-300 bg-white"
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm font-semibold ${isSelected ? "text-gray-800" : "text-gray-500"}`}>
                              {c.productNumber.split("\n")[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 一括送信ボタン */}
        {unvotedCount > 0 ? (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              onClick={handleSubmitAll}
              disabled={submitting}
              className="px-10 py-4 rounded-2xl font-black text-white text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              {submitting ? "保存中..." : `${unvotedCount}名分の投票を保存`}
            </button>
            <p className="text-gray-400 text-xs">全員選択後に保存してください</p>
          </div>
        ) : (
          <div className="mt-8 text-center">
            <p className="text-emerald-600 font-bold text-base">🎉 全員の投票が完了しています</p>
          </div>
        )}

        {/* フッターボタン */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a
            href="/kanri"
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors flex items-center gap-1"
          >
            ← 管理画面へ戻る
          </a>
          <a
            href="/judge/announce"
            className="px-8 py-3 rounded-xl font-bold text-white text-base shadow-md transition-all hover:shadow-lg hover:scale-[1.02] active:scale-100"
            style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
          >
            🎤 審査発表へ
          </a>
        </div>
      </div>
    </main>
  );
}
