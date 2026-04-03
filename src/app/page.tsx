"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CountdownTimer from "@/components/CountdownTimer";
import { ProductOption } from "@/lib/types";
import { saveVoteCookie, getVoteCookie, VoteCookieData } from "@/lib/cookies";

interface PublicConfig {
  title: string;
  deadline: string;
  options: ProductOption[];
  isActive: boolean;
  maxSelections: number;
  groups: string[];
}

type Step = "input" | "select" | "confirm" | "done";

export default function VotePage() {
  const router = useRouter();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [step, setStep] = useState<Step>("input");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [myVote, setMyVote] = useState<VoteCookieData | null>(null);
  const [showMyVote, setShowMyVote] = useState(false);

  const fetchConfig = useCallback(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: PublicConfig) => {
        setConfig(data);
        if (new Date(data.deadline) < new Date()) {
          setIsExpired(true);
        }
      });
  }, []);

  useEffect(() => {
    fetchConfig();
    const saved = getVoteCookie();
    if (saved) {
      setMyVote(saved);
      setShowMyVote(true);
    }
  }, [fetchConfig]);

  const handleExpired = useCallback(() => {
    setIsExpired(true);
  }, []);

  const normalizeEmployeeNumber = (value: string) => {
    return value
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[^0-9]/g, "");
  };

  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeNumber.trim()) {
      setError("社員番号を入力してください");
      return;
    }
    if (!groupName.trim()) {
      setError("所属組を入力してください");
      return;
    }
    setError("");
    setStep("select");
  };

  const isSameGroupOption = (option: ProductOption) => {
    if (!groupName.trim()) return false;
    const prefix = groupName.trim().slice(0, 3);
    return option.productNumber.slice(0, 3) === prefix;
  };

  const toggleSelection = (id: string) => {
    if (!config) return;
    const option = config.options.find((o) => o.id === id);
    if (option && isSameGroupOption(option)) return;
    const max = config.maxSelections;
    if (max === 1) {
      setSelectedIds(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((s) => s !== id));
    } else {
      if (selectedIds.length >= max) {
        setError(`${max}つまで選択できます`);
        return;
      }
      setSelectedIds([...selectedIds, id]);
      setError("");
    }
  };

  const handleSelectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    if (selectedIds.length !== config.maxSelections) {
      setError(`${config.maxSelections}つの作品を選択してください`);
      return;
    }
    setError("");
    setStep("confirm");
  };

  const handleVote = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber, groupName, selectedProductIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "投票に失敗しました");
        setStep("confirm");
        return;
      }
      const productNumbers = config?.options
        .filter((o) => selectedIds.includes(o.id))
        .map((o) => o.productNumber) ?? [];
      const cookieData: VoteCookieData = {
        employeeNumber,
        groupName,
        selectedProductIds: selectedIds,
        productNumbers,
        timestamp: new Date().toISOString(),
      };
      saveVoteCookie(cookieData);
      setMyVote(cookieData);
      setStep("done");
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToTop = () => {
    setStep("input");
    setEmployeeNumber("");
    setGroupName("");
    setSelectedIds([]);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedOptions = config?.options.filter((o) => selectedIds.includes(o.id)) ?? [];

  if (!config) {
    return (
      <main className="min-h-screen grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm tracking-widest">LOADING...</p>
        </div>
      </main>
    );
  }

  const maxSel = config.maxSelections;
  const selectionLabel = maxSel === 1
    ? "1作品を選択"
    : `${maxSel}作品を選択 (${selectedIds.length}/${maxSel})`;

  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 py-8 relative overflow-x-hidden">

      {/* ── 背景 Orb ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 大きな中心オーブ */}
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            top: "15%", left: "10%",
            width: "500px", height: "500px",
            background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)",
            animation: "orb-drift-1 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            bottom: "10%", right: "5%",
            width: "420px", height: "420px",
            background: "radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)",
            animation: "orb-drift-2 15s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full blur-2xl"
          style={{
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            width: "300px", height: "300px",
            background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
            animation: "orb-drift-3 18s ease-in-out infinite",
          }}
        />
        {/* 小さいアクセントオーブ */}
        <div
          className="absolute rounded-full blur-2xl"
          style={{
            top: "5%", right: "20%",
            width: "200px", height: "200px",
            background: "radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)",
            animation: "orb-drift-2 20s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute rounded-full blur-2xl"
          style={{
            bottom: "5%", left: "15%",
            width: "180px", height: "180px",
            background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)",
            animation: "orb-drift-1 22s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* 管理画面へリンク（右上固定） */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => router.push("/kanri")}
          className="text-slate-500 hover:text-slate-300 text-xs border border-slate-700 hover:border-slate-500 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-all"
        >
          管理画面へ
        </button>
      </div>

      <div className="relative z-10 w-full max-w-lg">

        {/* ── ヘッダー ── */}
        <div className="text-center mb-6">
          {/* ステータスバッジ */}
          <div
            className="inline-flex items-center gap-2 bg-black/60 border border-indigo-500/50 rounded-full px-5 py-2 mb-4"
            style={{ animation: "badge-pulse 2.5s ease-in-out infinite" }}
          >
            <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.9)]" />
            <span className="text-indigo-300 text-xs font-bold tracking-widest uppercase">
              {isExpired ? "投票終了" : config.isActive ? "投票受付中" : "投票停止中"}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold gradient-text-animated mb-2 drop-shadow-[0_0_30px_rgba(99,102,241,0.6)]">
            {config.title}
          </h1>
          <p className="text-slate-500 text-sm tracking-widest">
            優秀だと思う作品へ投票してください
          </p>
        </div>

        {/* ── カウントダウン ── */}
        <div className="mb-6">
          <CountdownTimer deadline={config.deadline} onExpired={handleExpired} onRefetch={fetchConfig} />
        </div>

        {/* ── 投票記録バナー ── */}
        {myVote && showMyVote && (
          <div className="mb-4 bg-black/70 border border-emerald-500/40 rounded-xl px-4 py-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-emerald-400 text-xs font-bold tracking-wide mb-1.5">
                  ✓ あなたの投票記録
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-slate-400 text-xs">
                    社員番号: <span className="text-slate-200 font-mono">{myVote.employeeNumber}</span>
                  </span>
                  <span className="text-slate-600 text-xs">|</span>
                  <span className="text-slate-400 text-xs">
                    所属組: <span className="text-slate-200 font-mono">{myVote.groupName}</span>
                  </span>
                  <span className="text-slate-600 text-xs">|</span>
                  <span className="text-slate-400 text-xs">
                    投票作品:{" "}
                    {myVote.productNumbers.map((pn, i) => (
                      <span key={i} className="text-emerald-300 font-mono font-bold whitespace-pre-line">
                        {i > 0 && <span className="text-slate-600 mx-1">/</span>}
                        {pn}
                      </span>
                    ))}
                  </span>
                </div>
                <p className="text-slate-600 text-xs mt-1">
                  {new Date(myVote.timestamp).toLocaleString("ja-JP")}
                </p>
              </div>
              <button
                onClick={() => setShowMyVote(false)}
                className="text-slate-600 hover:text-slate-400 text-xs flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── 投票終了 / 停止状態 ── */}
        {(isExpired || !config.isActive) ? (
          <div className="bg-black/80 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8 text-center shadow-[0_0_40px_rgba(239,68,68,0.1)]">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">
              {isExpired ? "投票期間が終了しました" : "現在投票を受け付けていません"}
            </h2>
            <p className="text-slate-500 text-sm">
              {isExpired ? "締め切り時間を過ぎています" : "管理者にお問い合わせください"}
            </p>
          </div>
        ) : (
          <>
            {/* ── メインカード ── */}
            <div className="relative bg-black/80 backdrop-blur-md border border-indigo-500/35 rounded-2xl p-6 sm:p-8 shadow-2xl glow-card-strong overflow-hidden">

              {/* カード上部のシマーライン */}
              <div
                className="absolute top-0 left-0 w-full h-px"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.8), rgba(139,92,246,0.8), rgba(6,182,212,0.8), transparent)",
                }}
              />
              {/* シマー光が流れる */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "-10%",
                    width: "15%",
                    height: "100%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                    animation: "shimmer-slide 4s ease-in-out infinite",
                  }}
                />
              </div>

              {/* ── STEP 1: 情報入力 ── */}
              {step === "input" && (
                <form onSubmit={handleEmployeeSubmit} className="flex flex-col gap-6">
                  <div>
                    <label className="block text-slate-200 text-sm font-bold mb-3 tracking-wide">
                      <span className="text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]">STEP 1</span>
                      <span className="text-slate-500 mx-2">/</span>
                      情報を入力
                    </label>
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-slate-400 text-xs mb-1.5 tracking-wide">あなたの所属している組</p>
                        {config.groups && config.groups.length > 0 ? (
                          <select
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-400 focus:shadow-[0_0_20px_rgba(99,102,241,0.35)] rounded-xl px-4 py-3 text-white outline-none transition-all text-sm sm:text-base"
                          >
                            <option value="" className="bg-slate-900 text-slate-400">-- 組を選択 --</option>
                            {config.groups.map((g) => (
                              <option key={g} value={g} className="bg-slate-900 text-white">{g}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="例: 鷺組"
                            className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-400 focus:shadow-[0_0_20px_rgba(99,102,241,0.35)] rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-all text-sm sm:text-base"
                            autoComplete="off"
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1.5 tracking-wide">社員番号</p>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={employeeNumber}
                          onChange={(e) => setEmployeeNumber(normalizeEmployeeNumber(e.target.value))}
                          placeholder="例: 12345"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-400 focus:shadow-[0_0_20px_rgba(99,102,241,0.35)] rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-all text-sm sm:text-base"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                  {error && (
                    <p className="text-red-400 text-sm bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="relative w-full overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(99,102,241,0.45)] hover:shadow-[0_0_50px_rgba(99,102,241,0.7)] active:scale-95 text-base tracking-wide"
                  >
                    次へ →
                  </button>
                </form>
              )}

              {/* ── STEP 2: 作品選択 ── */}
              {step === "select" && (
                <form onSubmit={handleSelectSubmit} className="flex flex-col gap-5">
                  <div>
                    <p className="text-slate-500 text-xs mb-1">
                      社員番号: <span className="text-indigo-300 font-mono">{employeeNumber}</span>
                      　所属組: <span className="text-indigo-300 font-mono">{groupName}</span>
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-slate-200 text-sm font-bold tracking-wide">
                        <span className="text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">STEP 2</span>
                        <span className="text-slate-500 mx-2">/</span>
                        投票する作品を選択
                      </label>
                      <span className={`text-xs font-mono px-3 py-1 rounded-full border transition-all ${
                        selectedIds.length === maxSel
                          ? "border-green-400/60 bg-green-500/15 text-green-300 shadow-[0_0_12px_rgba(74,222,128,0.3)]"
                          : "border-slate-700 bg-slate-900/80 text-slate-400"
                      }`}>
                        {selectionLabel}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      {config.options.map((option, index) => {
                        const isSelected = selectedIds.includes(option.id);
                        const isSameGroup = isSameGroupOption(option);
                        const isDisabled = isSameGroup || (!isSelected && selectedIds.length >= maxSel);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleSelection(option.id)}
                            disabled={isDisabled}
                            className={`
                              relative flex items-center gap-4 p-4 rounded-xl border-2 text-left
                              transition-all duration-200 w-full overflow-hidden
                              ${isSelected
                                ? "border-indigo-400 bg-indigo-950/60 shadow-[0_0_35px_rgba(99,102,241,0.55),inset_0_0_25px_rgba(99,102,241,0.08)]"
                                : isSameGroup
                                ? "border-red-900/30 bg-red-950/20 opacity-40 cursor-not-allowed"
                                : isDisabled
                                ? "border-slate-800/60 bg-black/40 opacity-30 cursor-not-allowed"
                                : "border-slate-700/60 bg-slate-950/70 hover:border-indigo-500/70 hover:bg-indigo-950/30 hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] cursor-pointer"
                              }
                            `}
                          >
                            {/* 選択済みのキラキラライン */}
                            {isSelected && (
                              <div
                                className="absolute top-0 left-0 w-full h-px"
                                style={{
                                  background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.9), transparent)",
                                }}
                              />
                            )}

                            <div className={`
                              flex-shrink-0 w-9 h-9 flex items-center justify-center text-sm font-bold transition-all
                              ${maxSel === 1
                                ? `rounded-full border-2 ${isSelected
                                    ? "border-indigo-400 bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.7)]"
                                    : "border-slate-600 text-slate-500"}`
                                : `rounded-lg border-2 ${isSelected
                                    ? "border-indigo-400 bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.7)]"
                                    : "border-slate-600 text-slate-500"}`
                              }
                            `}>
                              {isSelected ? "✓" : String.fromCharCode(65 + index)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-base sm:text-lg font-mono leading-snug whitespace-pre-line transition-all ${
                                isSelected ? "text-white drop-shadow-[0_0_8px_rgba(165,180,252,0.8)]" : "text-slate-200"
                              }`}>
                                {option.productNumber}
                              </p>
                              {option.description && option.description !== option.productNumber && (
                                <p className="text-slate-500 text-xs mt-0.5 truncate">{option.description}</p>
                              )}
                            </div>
                            {isSameGroup && (
                              <span className="flex-shrink-0 text-xs text-red-400/80 border border-red-800/40 rounded px-1.5 py-0.5 bg-red-950/30">
                                同組
                              </span>
                            )}
                            {isSelected && maxSel > 1 && (
                              <div className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-[0_0_12px_rgba(99,102,241,0.7)]">
                                {selectedIds.indexOf(option.id) + 1}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setStep("input"); setSelectedIds([]); setError(""); }}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-3.5 rounded-xl transition-all active:scale-95"
                    >
                      ← 戻る
                    </button>
                    <button
                      type="submit"
                      disabled={selectedIds.length !== maxSel}
                      className="flex-1 bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_50px_rgba(6,182,212,0.65)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      確認へ →
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 3: 確認 ── */}
              {step === "confirm" && (
                <div className="flex flex-col gap-6">
                  <h2 className="text-center text-slate-200 font-bold text-sm tracking-widest uppercase">
                    <span className="text-violet-400 drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]">STEP 3</span>
                    <span className="text-slate-500 mx-2">/</span>
                    投票内容の確認
                  </h2>

                  <div className="bg-slate-950/80 border border-slate-700/60 rounded-xl p-5 space-y-4 shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm">社員番号</span>
                      <span className="text-white font-mono font-bold text-lg">{employeeNumber}</span>
                    </div>
                    <div className="border-t border-slate-800" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm">所属組</span>
                      <span className="text-white font-mono font-bold">{groupName}</span>
                    </div>
                    <div className="border-t border-slate-800" />
                    <div>
                      <span className="text-slate-500 text-sm block mb-3">
                        投票作品 ({maxSel}択)
                      </span>
                      <div className="flex flex-col gap-2">
                        {selectedOptions.map((opt, i) => (
                          <div key={opt.id} className="flex items-center gap-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg px-3 py-2">
                            {maxSel > 1 && (
                              <span className="w-6 h-6 bg-indigo-500/60 rounded-full flex items-center justify-center text-indigo-200 text-xs font-bold flex-shrink-0">
                                {i + 1}
                              </span>
                            )}
                            <span className="text-indigo-200 font-mono font-bold text-base whitespace-pre-line leading-snug drop-shadow-[0_0_8px_rgba(165,180,252,0.6)]">
                              {opt.productNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-amber-400/80 text-xs bg-amber-950/30 border border-amber-500/20 rounded-lg py-2">
                    ⚠️ 一度投票すると変更できません
                  </p>

                  {error && (
                    <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStep("select"); setError(""); }}
                      disabled={loading}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                      ← 戻る
                    </button>
                    <button
                      onClick={handleVote}
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_35px_rgba(99,102,241,0.55)] hover:shadow-[0_0_60px_rgba(99,102,241,0.8)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-base"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          送信中...
                        </>
                      ) : "投票する ✓"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP Done: 完了 ── */}
              {step === "done" && (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="relative">
                    {/* 外側の大きなグロー */}
                    <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl animate-pulse scale-150" />
                    {/* 中間リング */}
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30 scale-125 animate-ping" />
                    <div
                      className="relative w-24 h-24 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-full flex items-center justify-center text-5xl shadow-[0_0_50px_rgba(99,102,241,0.7)] check-pop-animation"
                    >
                      ✓
                    </div>
                  </div>

                  <div>
                    <h2 className="text-3xl font-bold gradient-text-animated mb-1">投票完了！</h2>
                    <p className="text-slate-400 text-sm mb-5">ご投票ありがとうございました</p>
                    <div className="flex flex-col gap-2">
                      {selectedOptions.map((opt, i) => (
                        <div key={opt.id} className="flex items-center justify-center gap-2 bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-4 py-2.5">
                          {maxSel > 1 && (
                            <span className="text-indigo-500 text-xs font-mono">{i + 1}.</span>
                          )}
                          <span className="text-indigo-200 font-mono font-bold text-xl whitespace-pre-line leading-snug drop-shadow-[0_0_12px_rgba(165,180,252,0.8)]">
                            {opt.productNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-slate-500 text-xs mt-3">に投票しました</p>
                    <p className="text-slate-700 text-xs mt-2">
                      ※ 投票内容はこのブラウザに記録されました
                    </p>
                  </div>
                </div>
              )}
            </div>

            {step === "done" && (
              <div className="flex justify-end mt-3 pr-1">
                <button
                  type="button"
                  onClick={handleBackToTop}
                  className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
                >
                  Topへ
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  );
}
