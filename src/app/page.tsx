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

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: PublicConfig) => {
        setConfig(data);
        if (new Date(data.deadline) < new Date()) {
          setIsExpired(true);
        }
      });
    // cookieから自分の投票を読み込む
    const saved = getVoteCookie();
    if (saved) {
      setMyVote(saved);
      setShowMyVote(true);
    }
  }, []);

  const handleExpired = useCallback(() => {
    setIsExpired(true);
  }, []);

  // 全角数字→半角、数字以外を除去
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

  const toggleSelection = (id: string) => {
    if (!config) return;
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
      // 投票内容をcookieに保存
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
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-600/5 rounded-full blur-2xl" />
      </div>

      {/* 管理画面へリンク（右上固定） */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => router.push("/kanri")}
          className="text-slate-500 hover:text-slate-300 text-xs border border-slate-700 hover:border-slate-500 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          管理画面へ
        </button>
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-3">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-indigo-400 text-xs font-semibold tracking-widest uppercase">
              {isExpired ? "投票終了" : config.isActive ? "投票受付中" : "投票停止中"}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-1">
            {config.title}
          </h1>
          <p className="text-slate-500 text-sm">優秀だと思う作品へ投票してください</p>
        </div>

        {/* Countdown */}
        <div className="mb-6">
          <CountdownTimer deadline={config.deadline} onExpired={handleExpired} />
        </div>

        {/* 自分の投票確認バナー */}
        {myVote && showMyVote && (
          <div className="mb-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-emerald-400 text-xs font-semibold tracking-wide mb-1.5">
                  ✓ あなたの投票記録
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-slate-400 text-xs">
                    社員番号: <span className="text-slate-300 font-mono">{myVote.employeeNumber}</span>
                  </span>
                  <span className="text-slate-600 text-xs">|</span>
                  <span className="text-slate-400 text-xs">
                    所属組: <span className="text-slate-300 font-mono">{myVote.groupName}</span>
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

        {/* Expired / Inactive state */}
        {(isExpired || !config.isActive) ? (
          <div className="bg-slate-900/80 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">
              {isExpired ? "投票期間が終了しました" : "現在投票を受け付けていません"}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              {isExpired ? "締め切り時間を過ぎています" : "管理者にお問い合わせください"}
            </p>
          </div>
        ) : (
          <>
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl glow-card">

            {/* Step: Input employee number */}
            {step === "input" && (
              <form onSubmit={handleEmployeeSubmit} className="flex flex-col gap-6">
                <div>
                  <label className="block text-slate-300 text-sm font-semibold mb-2 tracking-wide">
                    <span className="text-indigo-400">STEP 1</span>&nbsp; 情報を入力
                  </label>
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-slate-400 text-xs mb-1.5">所属組</p>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="例: 鷺組"
                        className="w-full bg-slate-800/80 border border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all text-sm sm:text-base"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1.5">社員番号</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={employeeNumber}
                        onChange={(e) => setEmployeeNumber(normalizeEmployeeNumber(e.target.value))}
                        placeholder="例: 12345"
                        className="w-full bg-slate-800/80 border border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all text-sm sm:text-base"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                >
                  次へ →
                </button>
              </form>
            )}

            {/* Step: Select product */}
            {step === "select" && (
              <form onSubmit={handleSelectSubmit} className="flex flex-col gap-5">
                <div>
                  <p className="text-slate-400 text-xs mb-1">
                    社員番号: <span className="text-indigo-300 font-mono">{employeeNumber}</span>
                    　所属組: <span className="text-indigo-300 font-mono">{groupName}</span>
                  </p>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-slate-300 text-sm font-semibold tracking-wide">
                      <span className="text-cyan-400">STEP 2</span>&nbsp; 投票する作品を選択
                    </label>
                    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
                      selectedIds.length === maxSel
                        ? "border-green-500/50 bg-green-500/10 text-green-400"
                        : "border-slate-600 bg-slate-800 text-slate-400"
                    }`}>
                      {selectionLabel}
                    </span>
                  </div>

                  <div className="grid gap-2.5">
                    {config.options.map((option, index) => {
                      const isSelected = selectedIds.includes(option.id);
                      const isDisabled = !isSelected && selectedIds.length >= maxSel;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleSelection(option.id)}
                          disabled={isDisabled}
                          className={`
                            relative flex items-center gap-4 p-4 rounded-xl border-2 text-left
                            transition-all duration-200 w-full
                            ${isSelected
                              ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                              : isDisabled
                              ? "border-slate-800 bg-slate-800/30 opacity-40 cursor-not-allowed"
                              : "border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800/80 cursor-pointer"
                            }
                          `}
                        >
                          <div className={`
                            flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm font-bold transition-all
                            ${maxSel === 1
                              ? `rounded-full border-2 ${isSelected ? "border-indigo-400 bg-indigo-500 text-white" : "border-slate-600 text-slate-500"}`
                              : `rounded-lg border-2 ${isSelected ? "border-indigo-400 bg-indigo-500 text-white" : "border-slate-600 text-slate-500"}`
                            }
                          `}>
                            {isSelected ? "✓" : String.fromCharCode(65 + index)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-base sm:text-lg font-mono leading-snug whitespace-pre-line">
                              {option.productNumber}
                            </p>
                            {option.description && option.description !== option.productNumber && (
                              <p className="text-slate-400 text-xs mt-0.5 truncate">{option.description}</p>
                            )}
                          </div>
                          {isSelected && maxSel > 1 && (
                            <div className="flex-shrink-0 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {selectedIds.indexOf(option.id) + 1}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep("input"); setSelectedIds([]); setError(""); }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-medium py-3 rounded-xl transition-all active:scale-95"
                  >
                    ← 戻る
                  </button>
                  <button
                    type="submit"
                    disabled={selectedIds.length !== maxSel}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    確認へ →
                  </button>
                </div>
              </form>
            )}

            {/* Step: Confirm */}
            {step === "confirm" && (
              <div className="flex flex-col gap-6">
                <h2 className="text-center text-slate-300 font-semibold text-sm tracking-widest uppercase">
                  <span className="text-violet-400">STEP 3</span>&nbsp; 投票内容の確認
                </h2>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">社員番号</span>
                    <span className="text-white font-mono font-bold">{employeeNumber}</span>
                  </div>
                  <div className="border-t border-slate-700" />
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">所属組</span>
                    <span className="text-white font-mono font-bold">{groupName}</span>
                  </div>
                  <div className="border-t border-slate-700" />
                  <div>
                    <span className="text-slate-400 text-sm block mb-2">
                      投票作品 ({maxSel}択)
                    </span>
                    <div className="flex flex-col gap-2">
                      {selectedOptions.map((opt, i) => (
                        <div key={opt.id} className="flex items-center gap-3">
                          {maxSel > 1 && (
                            <span className="w-5 h-5 bg-indigo-600/50 rounded-full flex items-center justify-center text-indigo-300 text-xs font-bold flex-shrink-0">
                              {i + 1}
                            </span>
                          )}
                          <span className="text-indigo-300 font-mono font-bold text-base whitespace-pre-line leading-snug">
                            {opt.productNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-center text-amber-400/80 text-xs">
                  ⚠️ 一度投票すると変更できません
                </p>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep("select"); setError(""); }}
                    disabled={loading}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-medium py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    ← 戻る
                  </button>
                  <button
                    onClick={handleVote}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
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

            {/* Step: Done */}
            {step === "done" && (
              <div className="flex flex-col items-center gap-6 py-4 text-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-4xl shadow-lg shadow-indigo-500/40 float-animation">
                    ✓
                  </div>
                  <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">投票完了！</h2>
                  <p className="text-slate-400 text-sm mb-4">ご投票ありがとうございました</p>
                  <div className="flex flex-col gap-1.5">
                    {selectedOptions.map((opt, i) => (
                      <div key={opt.id} className="flex items-center justify-center gap-2">
                        {maxSel > 1 && (
                          <span className="text-slate-500 text-xs">{i + 1}.</span>
                        )}
                        <span className="text-indigo-300 font-mono font-bold text-lg whitespace-pre-line leading-snug">
                          {opt.productNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-500 text-xs mt-2">に投票しました</p>
                  <p className="text-slate-600 text-xs mt-3">
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
