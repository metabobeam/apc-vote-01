"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReviewTarget, DEFAULT_CRITERIA_LABELS } from "@/lib/types";

interface ScoreInput {
  criterion1: number;
  criterion2: number;
  criterion3: number;
}

type ScoreMap = Record<string, ScoreInput>;

interface PageData {
  judges: string[];
  targets: ReviewTarget[];
  criteriaLabels: [string, string, string];
  judgeProgress: Record<string, string[]>;
  judgeScores: Record<string, Record<string, { criterion1: number; criterion2: number; criterion3: number }>>;
}

function ScoreSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-bold transition-all border-2 ${
            value === n
              ? "bg-teal-600 border-teal-600 text-white shadow-md scale-105"
              : "bg-white border-gray-300 text-gray-600 hover:border-teal-400 hover:bg-teal-50"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function ReviewPageInner() {
  const searchParams = useSearchParams();
  const judgeParam = searchParams.get("judge");

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJudge, setSelectedJudge] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreMap>({});
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [savedTargets, setSavedTargets] = useState<Set<string>>(new Set());
  const [errorMsgs, setErrorMsgs] = useState<Record<string, string>>({});

  // リセット用state
  const [resetTarget, setResetTarget] = useState<"all" | string | null>(null); // "all" or judgeName
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/review");
      if (!res.ok) throw new Error();
      const json = (await res.json()) as PageData;
      setData(json);
      // URLパラメータで審査員が指定されていれば自動選択
      if (judgeParam && json.judges.includes(judgeParam)) {
        const saved = json.judgeScores[judgeParam] ?? {};
        const initial: ScoreMap = {};
        for (const t of json.targets) {
          initial[t.id] = saved[t.id] ? { ...saved[t.id] } : { criterion1: 0, criterion2: 0, criterion3: 0 };
        }
        setScores(initial);
        setSavedTargets(new Set(Object.keys(saved)));
        setSelectedJudge(judgeParam);
      }
      // 審査員選択中なら、サーバー上のスコアで未入力分のみ補完
      setSelectedJudge((currentJudge) => {
        if (currentJudge) {
          const saved = json.judgeScores[currentJudge] ?? {};
          setScores((prev) => {
            const next = { ...prev };
            for (const t of json.targets) {
              if (saved[t.id] && !next[t.id]?.criterion1) {
                next[t.id] = { ...saved[t.id] };
              }
            }
            return next;
          });
          setSavedTargets(new Set(Object.keys(saved)));
        }
        return currentJudge;
      });
    } catch {
      // ignore on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectJudge = (judge: string) => {
    setSelectedJudge(judge);
    setSavedTargets(new Set());
    setErrorMsgs({});
    if (data) {
      const initial: ScoreMap = {};
      const saved = data.judgeScores[judge] ?? {};
      for (const t of data.targets) {
        // 入力済みのスコアがあれば復元、なければ0
        initial[t.id] = saved[t.id]
          ? { ...saved[t.id] }
          : { criterion1: 0, criterion2: 0, criterion3: 0 };
      }
      setScores(initial);
      // 復元したターゲットを「保存済み」としてマーク
      const alreadySaved = new Set(Object.keys(saved));
      setSavedTargets(alreadySaved);
    }
  };

  const handleScoreChange = (targetId: string, criterion: keyof ScoreInput, value: number) => {
    setScores((prev) => ({
      ...prev,
      [targetId]: { ...prev[targetId], [criterion]: value },
    }));
    // 入力したら保存済みマークをリセット
    setSavedTargets((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  };

  const handleSaveOne = async (targetId: string) => {
    if (!selectedJudge) return;
    const s = scores[targetId] ?? { criterion1: 0, criterion2: 0, criterion3: 0 };
    if (s.criterion1 === 0 || s.criterion2 === 0 || s.criterion3 === 0) {
      setErrorMsgs((prev) => ({ ...prev, [targetId]: "全ての項目に点数を入力してください" }));
      return;
    }
    setErrorMsgs((prev) => { const n = { ...prev }; delete n[targetId]; return n; });
    setSavingTarget(targetId);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judgeName: selectedJudge,
          scores: [{ productId: targetId, ...s }],
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        setErrorMsgs((prev) => ({ ...prev, [targetId]: err.error || "保存に失敗しました" }));
        return;
      }
      setSavedTargets((prev) => new Set([...prev, targetId]));
      // バックグラウンドでデータ更新（進捗に反映）
      fetchData(true);
    } catch {
      setErrorMsgs((prev) => ({ ...prev, [targetId]: "通信エラーが発生しました" }));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    setResetMsg("");
    try {
      const body = resetTarget === "all"
        ? { clearAll: true, password: resetPassword }
        : { judgeName: resetTarget, password: resetPassword };
      const res = await fetch("/api/review", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setResetMsg("✓ リセットしました");
        setResetTarget(null);
        setResetPassword("");
        await fetchData();
      } else {
        const d = await res.json();
        setResetMsg(`✗ ${d.error ?? "削除に失敗しました"}`);
      }
    } catch {
      setResetMsg("✗ 通信エラーが発生しました");
    } finally {
      setResetLoading(false);
      setTimeout(() => setResetMsg(""), 3000);
    }
  };

  // 降順（登録順の逆）
  const sortedTargets = data ? [...data.targets].reverse() : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <a
              href="/kanri"
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
            >
              ← 管理画面
            </a>
          </div>
          <div className="inline-flex items-center gap-2 bg-teal-100 border border-teal-200 rounded-full px-3 py-1 mb-2">
            <span className="text-teal-700 text-xs font-semibold tracking-widest">REVIEW</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">📋 討議班審査</h1>
          <p className="text-sm text-gray-500">各班を3項目（各1〜5点）で採点してください</p>
        </div>

        {!data ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-red-500 text-sm">データを取得できませんでした</p>
          </div>
        ) : !selectedJudge ? (
          /* STEP 1: 審査員選択 */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-700 mb-4">審査員を選択してください</h2>
            {data.judges.length === 0 ? (
              <p className="text-sm text-gray-400">審査員が登録されていません。管理画面で登録してください。</p>
            ) : data.targets.length === 0 ? (
              <p className="text-sm text-gray-400">討議班が登録されていません。管理画面で登録してください。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.judges.map((judge) => {
                  const submittedCount = (data.judgeProgress[judge] ?? []).length;
                  const total = data.targets.length;
                  const done = total > 0 && submittedCount === total;
                  return (
                    <div key={judge} className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectJudge(judge)}
                        className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                          done
                            ? "border-teal-300 bg-teal-50 hover:bg-teal-100"
                            : "border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50"
                        }`}
                      >
                        <span className="font-medium text-gray-800">{judge}</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            done
                              ? "bg-teal-200 text-teal-700"
                              : submittedCount > 0
                              ? "bg-yellow-200 text-yellow-700"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {done ? "✓ 完了" : submittedCount > 0 ? `${submittedCount}/${total}` : "未入力"}
                        </span>
                      </button>
                      {/* 審査員ごとリセットボタン（採点データがある場合のみ表示） */}
                      {submittedCount > 0 && (
                        <button
                          onClick={() => { setResetTarget(judge); setResetPassword(""); setResetMsg(""); }}
                          className="flex-shrink-0 text-xs text-rose-400 hover:text-rose-600 border border-rose-300 hover:border-rose-500 bg-rose-50 hover:bg-rose-100 px-2.5 py-2 rounded-xl transition-all"
                          title={`${judge}の採点をリセット`}
                        >
                          リセット
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 全データリセット */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {resetMsg && (
                    <p className={`text-sm mb-2 ${resetMsg.startsWith("✓") ? "text-teal-600" : "text-rose-500"}`}>
                      {resetMsg}
                    </p>
                  )}
                  <button
                    onClick={() => { setResetTarget("all"); setResetPassword(""); setResetMsg(""); }}
                    className="text-xs text-rose-400 hover:text-rose-600 border border-rose-200 hover:border-rose-400 bg-white hover:bg-rose-50 px-3 py-2 rounded-xl transition-all"
                  >
                    🗑 全採点データをリセット
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STEP 2: 採点入力 */
          <div className="flex flex-col gap-5">
            {/* 審査員名・更新・戻るボタン */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-sm text-gray-500">審査員：</span>
                <span className="text-base font-bold text-teal-700 ml-1">{selectedJudge}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="text-sm text-teal-600 hover:text-teal-800 px-3 py-1.5 rounded-lg border border-teal-300 hover:border-teal-400 bg-teal-50 hover:bg-teal-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {refreshing ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  ) : "🔄"} 更新
                </button>
                <button
                  onClick={() => {
                    setSelectedJudge(null);
                    setSavedTargets(new Set());
                    setErrorMsgs({});
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
                >
                  ← 戻る
                </button>
              </div>
            </div>

            {/* 採点済み通知 */}
            {(data.judgeProgress[selectedJudge]?.length ?? 0) > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 text-sm text-yellow-700">
                ⚠️ 採点済みのデータがあります。上書き保存が可能です。
              </div>
            )}

            {/* 班ごとの採点カード（降順） */}
            {sortedTargets.map((target, idx) => {
              const s = scores[target.id] ?? { criterion1: 0, criterion2: 0, criterion3: 0 };
              const total = s.criterion1 + s.criterion2 + s.criterion3;
              const alreadyDone = (data.judgeProgress[selectedJudge] ?? []).includes(target.id);
              const justSaved = savedTargets.has(target.id);
              const isSaving = savingTarget === target.id;
              const errMsg = errorMsgs[target.id];
              // 全体の順番（表示はN番目、降順なので逆インデックス）
              const displayNo = sortedTargets.length - idx;

              return (
                <div
                  key={target.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm p-5 transition-all ${
                    justSaved
                      ? "border-teal-400"
                      : alreadyDone
                      ? "border-teal-200"
                      : "border-gray-200"
                  }`}
                >
                  {/* カードヘッダー */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        No.{displayNo}
                      </span>
                      <h3 className="text-lg font-bold text-gray-800 mt-0.5">{target.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">合計</p>
                      <p
                        className={`text-2xl font-black ${
                          total >= 12
                            ? "text-teal-600"
                            : total >= 9
                            ? "text-blue-600"
                            : total > 0
                            ? "text-gray-700"
                            : "text-gray-300"
                        }`}
                      >
                        {total > 0 ? total : "—"}
                        {total > 0 && <span className="text-sm font-normal text-gray-400">/15</span>}
                      </p>
                    </div>
                  </div>

                  {/* 採点項目 */}
                  <div className="flex flex-col gap-4 mb-4">
                    {DEFAULT_CRITERIA_LABELS.map((desc, ci) => {
                      const key = `criterion${ci + 1}` as keyof ScoreInput;
                      return (
                        <div key={ci} className="flex flex-col gap-1.5">
                          <p className="text-sm font-medium text-gray-700">
                            <span className="text-gray-400 mr-1">{ci + 1}.</span>{desc}
                          </p>
                          <ScoreSelector
                            value={s[key]}
                            onChange={(v) => handleScoreChange(target.id, key, v)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* エラーメッセージ */}
                  {errMsg && (
                    <p className="text-xs text-red-500 mb-2">{errMsg}</p>
                  )}

                  {/* 保存ボタン */}
                  <button
                    type="button"
                    onClick={() => handleSaveOne(target.id)}
                    disabled={isSaving || total === 0}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                      justSaved
                        ? "bg-teal-100 border-2 border-teal-400 text-teal-700"
                        : "bg-teal-600 hover:bg-teal-500 disabled:bg-gray-200 disabled:text-gray-400 text-white shadow-sm"
                    }`}
                  >
                    {isSaving
                      ? "保存中..."
                      : justSaved
                      ? "✓ 保存済み"
                      : "保存"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* フッター */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              if (selectedJudge) {
                setSelectedJudge(null);
                setSavedTargets(new Set());
                setErrorMsgs({});
              } else {
                window.history.back();
              }
            }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 戻る
          </button>
        </div>
      </div>

      {/* リセット確認モーダル */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-800 mb-1">
              {resetTarget === "all" ? "全採点データをリセット" : `「${resetTarget}」の採点をリセット`}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {resetTarget === "all"
                ? "全審査員の採点データが削除されます。"
                : `${resetTarget}の全採点データが削除されます。`}
              この操作は取り消せません。
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">管理者パスワード</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReset()}
                placeholder="パスワードを入力"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200"
                autoFocus
              />
            </div>
            {resetMsg && (
              <p className="text-sm text-rose-500 mb-3">{resetMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setResetTarget(null); setResetPassword(""); setResetMsg(""); }}
                disabled={resetLoading}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={resetLoading || !resetPassword}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resetLoading ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">読み込み中...</p></main>}>
      <ReviewPageInner />
    </Suspense>
  );
}
