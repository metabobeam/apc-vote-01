"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductOption } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { getResultsAuth, setResultsAuth, clearResultsAuth, saveAdminPass, getAdminPass } from "@/lib/cookies";

interface Config {
  title: string;
  deadline: string;
  options: ProductOption[];
  isActive: boolean;
  maxSelections: number;
  judges: string[];
}

interface JudgeData {
  judges: string[];
  candidates: { productId: string; productNumber: string; description: string; count: number }[];
  judgeVotes: { judgeName: string; selectedProductId: string }[];
  results: { productId: string; productNumber: string; description: string; judgeVoteCount: number }[];
}

type AdminStep = "login" | "dashboard";

export default function AdminPage() {
  const router = useRouter();
  const [step, setStep] = useState<AdminStep>("login");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // 当日認証済みならスキップ（保存済みパスワードも復元）
  useEffect(() => {
    if (getResultsAuth()) {
      const saved = getAdminPass();
      if (saved) setPassword(saved);
      setStep("dashboard");
      fetchConfig();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [config, setConfig] = useState<Config | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxSelections, setMaxSelections] = useState(1);
  const [options, setOptions] = useState<ProductOption[]>([]);

  const [judges, setJudges] = useState<string[]>([]);
  const [newJudgeName, setNewJudgeName] = useState("");
  const [judgeData, setJudgeData] = useState<JudgeData | null>(null);
  const [showWinner, setShowWinner] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const fetchConfig = async () => {
    const res = await fetch("/api/config");
    const data: Config = await res.json();
    setConfig(data);
    setTitle(data.title);
    setIsActive(data.isActive);
    setMaxSelections(data.maxSelections ?? 1);
    // Convert ISO string to local datetime-local value
    const d = new Date(data.deadline);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDeadline(local);
    setOptions(data.options.map((o) => ({ ...o })));
    setJudges(data.judges ?? []);
    fetchJudgeData();
  };

  const fetchJudgeData = async () => {
    try {
      const res = await fetch("/api/judge");
      if (res.ok) setJudgeData(await res.json());
    } catch { /* ignore */ }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setLoginError("");
      setResultsAuth();     // 当日有効で認証を保存
      saveAdminPass(password); // パスワードも保存（設定保存時に使用）
      setStep("dashboard");
      fetchConfig();
    } else {
      setLoginError("パスワードが正しくありません");
    }
  };

  const handleLogout = () => {
    clearResultsAuth();
    setStep("login");
    setPassword("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    try {
      // Convert local datetime to ISO
      const deadlineISO = new Date(deadline).toISOString();
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          title,
          deadline: deadlineISO,
          isActive,
          maxSelections,
          options,
          judges,
        }),
      });
      if (res.ok) {
        setSaveMsg("✓ 設定を保存しました");
        fetchConfig();
      } else {
        const data = await res.json();
        setSaveMsg(`✗ ${data.error}`);
      }
    } catch {
      setSaveMsg("✗ 保存に失敗しました");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  const addOption = () => {
    if (options.length >= 8) return;
    setOptions([...options, { id: uuidv4(), productNumber: "", description: "" }]);
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) return;
    setOptions(options.filter((o) => o.id !== id));
  };

  const updateOption = (id: string, field: keyof ProductOption, value: string) => {
    setOptions(options.map((o) => {
      if (o.id !== id) return o;
      const updated = { ...o, [field]: value };
      if (field === "productNumber") {
        updated.description = value;
      }
      return updated;
    }));
  };

  // 審査員リストを即時保存
  const saveJudges = async (newJudges: string[]) => {
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, judges: newJudges }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveMsg(`✗ ${data.error ?? "保存に失敗しました"}`);
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } catch {
      setSaveMsg("✗ 保存に失敗しました");
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/results", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setSaveMsg("✓ 投票データをリセットしました");
      } else {
        const data = await res.json();
        setSaveMsg(`✗ ${data.error}`);
      }
    } catch {
      setSaveMsg("✗ リセットに失敗しました");
    } finally {
      setResetting(false);
      setResetConfirm(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  if (!config && step === "dashboard") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start px-4 py-8">

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-violet-100 border border-violet-200 rounded-full px-3 py-1 mb-2">
              <span className="text-violet-600 text-xs font-semibold tracking-widest">ADMIN PANEL</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">管理者ダッシュボード</h1>
          </div>
          {step === "dashboard" && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="text-gray-400 hover:text-gray-700 text-sm transition-colors"
              >
                ← 投票ページ
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 text-xs border border-gray-300 hover:border-gray-400 px-2.5 py-1 rounded-lg transition-colors"
              >
                ログアウト
              </button>
            </div>
          )}
        </div>

        {/* Login */}
        {step === "login" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔐</div>
              <h2 className="text-xl font-bold text-gray-800">管理者認証</h2>
              <p className="text-gray-500 text-sm mt-1">管理者パスワードを入力してください</p>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                className="w-full bg-white border border-gray-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition-all"
              />
              {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
              >
                ログイン
              </button>
            </form>
            <button
              onClick={() => router.push("/")}
              className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm transition-colors"
            >
              ← 投票ページへ戻る
            </button>
          </div>
        )}

        {/* Dashboard */}
        {step === "dashboard" && config && (
          <>
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Basic Settings */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-gray-700 font-semibold text-sm tracking-wide mb-5 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-500 rounded-full" />
                基本設定
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-gray-500 text-xs mb-1.5 tracking-wide">投票タイトル</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-gray-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-2.5 text-gray-800 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 text-xs mb-1.5 tracking-wide">締め切り日時</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-white border border-gray-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-2.5 text-gray-800 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 text-xs mb-2 tracking-wide">投票択数</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxSelections(n)}
                        className={`
                          flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all
                          ${maxSelections === n
                            ? "border-cyan-500 bg-cyan-50 text-cyan-600"
                            : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                          }
                        `}
                      >
                        {n}択
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-400 text-xs mt-1.5">
                    {maxSelections === 1 ? "1作品のみ選択" : `上位${maxSelections}作品を選択`}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">投票受付</span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`
                      relative w-12 h-6 rounded-full transition-all duration-300
                      ${isActive ? "bg-indigo-500" : "bg-gray-300"}
                    `}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300"
                      style={{ left: isActive ? "26px" : "2px" }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-gray-700 font-semibold text-sm tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                  投票選択肢 ({options.length}/8)
                </h2>
                <button
                  type="button"
                  onClick={addOption}
                  disabled={options.length >= 8}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + 追加
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 flex-shrink-0 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <textarea
                      rows={2}
                      value={option.productNumber}
                      onChange={(e) => updateOption(option.id, "productNumber", e.target.value)}
                      placeholder={`商品番号 ${index + 1}（改行で2行表示可）`}
                      className="flex-1 bg-white border border-gray-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 rounded-xl px-3 py-2 text-gray-800 placeholder-gray-300 outline-none transition-all text-sm font-mono resize-none leading-snug"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(option.id)}
                      disabled={options.length <= 2}
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 bg-gray-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-3">選択肢は2〜8個設定できます</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {saveMsg && (
                <p className={`text-center text-sm font-medium ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {saveMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    保存中...
                  </>
                ) : "設定を保存"}
              </button>

              <div className="border-t border-gray-200 pt-3">
                {!resetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setResetConfirm(true)}
                    className="w-full bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 text-gray-400 hover:text-red-500 font-medium py-3 rounded-xl transition-all text-sm"
                  >
                    投票データをリセット
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-600 text-sm text-center mb-3 font-medium">
                      ⚠️ 全投票データを削除します。この操作は取り消せません。
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResetConfirm(false)}
                        className="flex-1 bg-white border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={resetting}
                        className="flex-1 bg-red-500 border border-red-500 text-white py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {resetting ? "削除中..." : "削除する"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/results")}
                  className="flex-1 text-gray-400 hover:text-gray-600 text-sm transition-colors py-2"
                >
                  結果ページ →
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/announce")}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm py-2.5 rounded-xl transition-all shadow-md"
                >
                  🎬 結果発表へ
                </button>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-3 mt-1">
                <button
                  type="button"
                  onClick={() => router.push("/admin/votes")}
                  className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-600 font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <span>🗳️</span> 投票内容の確認・無効票削除
                </button>
              </div>
            </div>
          </form>

          {/* ────────────── セクション区切り ────────────── */}
          <div className="mt-10 mb-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase px-2 whitespace-nowrap">審査員・優勝決定</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-gray-300 to-transparent" />
          </div>

          {/* ── 審査員管理 ── */}
          <div className="bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800">⚖️ 審査員管理</h2>
              <button
                type="button"
                onClick={() => router.push("/judge")}
                className="text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                審査員投票ページ →
              </button>
            </div>

            {/* 審査員追加 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newJudgeName}
                onChange={(e) => setNewJudgeName(e.target.value)}
                placeholder="審査員名を入力"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const name = newJudgeName.trim();
                    if (name && !judges.includes(name)) {
                      const next = [...judges, name];
                      setJudges(next);
                      setNewJudgeName("");
                      saveJudges(next);
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const name = newJudgeName.trim();
                  if (name && !judges.includes(name)) {
                    const next = [...judges, name];
                    setJudges(next);
                    setNewJudgeName("");
                    saveJudges(next);
                  }
                }}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
              >
                追加
              </button>
            </div>

            {judges.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {judges.map((name) => {
                  const voted = judgeData?.judgeVotes.some((jv) => jv.judgeName === name);
                  return (
                    <span key={name} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${voted ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-100 border-gray-200 text-gray-700"}`}>
                      {voted && <span className="text-xs">✓</span>}
                      {name}
                      {!voted && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = judges.filter((j) => j !== name);
                            setJudges(next);
                            saveJudges(next);
                          }}
                          className="text-gray-400 hover:text-red-500 ml-0.5 transition-colors"
                        >×</button>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-xs mb-4">審査員が未登録です</p>
            )}

            <p className="text-xs text-gray-400 mb-3">
              ※ 審査員の追加・削除は即座に保存されます
            </p>

            {/* 投票状況 */}
            {judgeData && judgeData.judgeVotes.length > 0 && (
              <div className="border-t border-gray-100 pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-500 mb-2">投票済み審査員</p>
                <div className="flex flex-col gap-1.5">
                  {judgeData.judgeVotes.map((jv) => {
                    const product = judgeData.candidates.find((c) => c.productId === jv.selectedProductId)
                      ?? judgeData.results.find((r) => r.productId === jv.selectedProductId);
                    return (
                      <div key={jv.judgeName} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{jv.judgeName}</span>
                        <span className="text-indigo-600 font-medium text-xs">
                          {product?.productNumber.replace("\n", " ") ?? jv.selectedProductId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── 優勝決定画面 ── */}
          <div className="mt-4 bg-white border-2 border-amber-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800">🏆 優勝決定</h2>
              <button
                type="button"
                onClick={() => { fetchJudgeData(); setShowWinner(true); }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-md"
              >
                結果表示
              </button>
            </div>

            {judgeData && (
              <div className="text-sm text-gray-500">
                審査員投票数: {judgeData.judgeVotes.length} / {judgeData.judges.length} 名
              </div>
            )}

            {showWinner && judgeData && (() => {
              const maxVotes = Math.max(...judgeData.results.map((r) => r.judgeVoteCount), 0);
              const winners = maxVotes > 0
                ? judgeData.results.filter((r) => r.judgeVoteCount === maxVotes)
                : [];
              return (
                <div className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 text-center">
                  {winners.length > 0 ? (
                    <>
                      <p className="text-amber-600 text-xs font-bold tracking-widest mb-2">🎉 WINNER</p>
                      {winners.map((w) => (
                        <div key={w.productId} className="mb-2">
                          {w.productNumber.split("\n").map((line, i) => (
                            <p key={i} className={`font-black text-amber-800 ${i === 0 ? "text-2xl" : "text-base"}`}>{line}</p>
                          ))}
                        </div>
                      ))}
                      <p className="text-amber-700 text-sm mt-2">審査員票 <span className="text-xl font-black">{maxVotes}</span> 票</p>
                      {winners.length > 1 && (
                        <p className="text-amber-500 text-xs mt-1">※ {winners.length}組同点優勝</p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 text-sm">まだ審査員の投票がありません</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowWinner(false)}
                    className="mt-4 text-amber-600 text-xs hover:text-amber-800 transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              );
            })()}
          </div>
          </>
        )}
      </div>
    </main>
  );
}
