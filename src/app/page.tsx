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
      <main className="min-h-screen metal-grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "rgba(180,190,210,0.6)", borderTopColor: "transparent" }} />
          <p className="text-slate-400 text-sm tracking-widest">LOADING...</p>
        </div>
      </main>
    );
  }

  const maxSel = config.maxSelections;
  const selectionLabel = maxSel === 1
    ? "1作品を選択"
    : `${maxSel}作品を選択 (${selectedIds.length}/${maxSel})`;

  // ── シルバーメタル カラーパレット ──
  const M = {
    silver:     "#c8d0dc",   // 基本シルバー
    silverBrt:  "#e8edf5",   // 明るいシルバー
    silverDim:  "#6b7585",   // 暗いシルバー
    steel:      "#9aa3b0",   // スチールグレー
    btnGrad:    "linear-gradient(135deg, #3d4552 0%, #7a8494 28%, #e2e8f0 50%, #7a8494 72%, #3d4552 100%)",
    btnHover:   "linear-gradient(135deg, #4a5566 0%, #8a96a8 28%, #f0f4fa 50%, #8a96a8 72%, #4a5566 100%)",
    cardBg:     "rgba(16,18,24,0.94)",
    cardBorder: "rgba(180,188,205,0.18)",
    inputBg:    "rgba(8,10,16,0.85)",
    inputBorder:"rgba(110,120,140,0.5)",
    inputFocus: "rgba(200,210,230,0.75)",
    selBorder:  "rgba(200,210,230,0.7)",
    selBg:      "rgba(200,210,230,0.05)",
    selGlow:    "0 0 28px rgba(190,200,220,0.45), inset 0 0 20px rgba(190,200,220,0.04)",
    innerBg:    "rgba(255,255,255,0.025)",
    innerBorder:"rgba(140,150,170,0.22)",
  };

  return (
    <main className="min-h-screen metal-grid-bg flex flex-col items-center justify-center px-4 py-8 relative overflow-x-hidden">

      {/* ── 背景 Orb（シルバートーン） ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full blur-3xl" style={{ top:"12%", left:"8%", width:"520px", height:"520px", background:"radial-gradient(circle, rgba(140,150,175,0.14) 0%, transparent 70%)", animation:"orb-drift-1 13s ease-in-out infinite" }} />
        <div className="absolute rounded-full blur-3xl" style={{ bottom:"8%", right:"4%", width:"440px", height:"440px", background:"radial-gradient(circle, rgba(160,168,185,0.10) 0%, transparent 70%)", animation:"orb-drift-2 16s ease-in-out infinite" }} />
        <div className="absolute rounded-full blur-2xl" style={{ top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"320px", height:"320px", background:"radial-gradient(circle, rgba(180,185,200,0.07) 0%, transparent 70%)", animation:"orb-drift-3 19s ease-in-out infinite" }} />
        <div className="absolute rounded-full blur-2xl" style={{ top:"4%", right:"18%", width:"200px", height:"200px", background:"radial-gradient(circle, rgba(200,205,215,0.08) 0%, transparent 70%)", animation:"orb-drift-2 21s ease-in-out infinite reverse" }} />
        <div className="absolute rounded-full blur-2xl" style={{ bottom:"4%", left:"14%", width:"180px", height:"180px", background:"radial-gradient(circle, rgba(150,155,170,0.07) 0%, transparent 70%)", animation:"orb-drift-1 23s ease-in-out infinite reverse" }} />
      </div>

      {/* 管理画面へリンク（右上固定） */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => router.push("/kanri")}
          style={{ background:"rgba(16,18,24,0.8)", border:"1px solid rgba(140,150,170,0.3)", color: M.silverDim }}
          className="hover:text-slate-300 text-xs backdrop-blur-sm px-3 py-1.5 rounded-lg transition-all"
        >
          管理画面へ
        </button>
      </div>

      <div className="relative z-10 w-full max-w-lg">

        {/* ── ヘッダー ── */}
        <div className="text-center mb-6">
          {/* ステータスバッジ */}
          <div
            className="metal-badge-pulse inline-flex items-center gap-2 rounded-full px-5 py-2 mb-4"
            style={{ background:"rgba(12,14,20,0.75)", border:`1px solid rgba(160,170,190,0.35)` }}
          >
            <span className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: M.silver, boxShadow:`0 0 8px ${M.silver}` }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: M.steel }}>
              {isExpired ? "投票終了" : config.isActive ? "投票受付中" : "投票停止中"}
            </span>
          </div>

          {/* タイトル — シルバーグラデーション */}
          <h1
            className="text-4xl sm:text-5xl font-bold mb-2"
            style={{
              background: "linear-gradient(135deg, #94a3b8, #f1f5f9, #94a3b8, #e2e8f0, #f8fafc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 20px rgba(200,210,230,0.5))",
            }}
          >
            {config.title}
          </h1>
          <p className="text-sm tracking-widest" style={{ color: M.silverDim }}>
            優秀だと思う作品へ投票してください
          </p>
        </div>

        {/* ── カウントダウン ── */}
        <div className="mb-6">
          <CountdownTimer deadline={config.deadline} onExpired={handleExpired} onRefetch={fetchConfig} />
        </div>

        {/* ── 投票記録バナー ── */}
        {myVote && showMyVote && (
          <div className="mb-4 rounded-xl px-4 py-3"
            style={{ background:"rgba(12,16,22,0.85)", border:"1px solid rgba(160,200,160,0.3)", boxShadow:"0 0 18px rgba(140,180,140,0.12)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold tracking-wide mb-1.5" style={{ color:"#86efac" }}>
                  ✓ あなたの投票記録
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-slate-400 text-xs">
                    社員番号: <span className="font-mono" style={{ color: M.silverBrt }}>{myVote.employeeNumber}</span>
                  </span>
                  <span className="text-slate-600 text-xs">|</span>
                  <span className="text-slate-400 text-xs">
                    所属組: <span className="font-mono" style={{ color: M.silverBrt }}>{myVote.groupName}</span>
                  </span>
                  <span className="text-slate-600 text-xs">|</span>
                  <span className="text-slate-400 text-xs">
                    投票作品:{" "}
                    {myVote.productNumbers.map((pn, i) => (
                      <span key={i} className="font-mono font-bold whitespace-pre-line" style={{ color:"#86efac" }}>
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
              <button onClick={() => setShowMyVote(false)} className="text-slate-600 hover:text-slate-400 text-xs flex-shrink-0 mt-0.5">✕</button>
            </div>
          </div>
        )}

        {/* ── 投票終了 / 停止状態 ── */}
        {(isExpired || !config.isActive) ? (
          <div className="backdrop-blur-sm rounded-2xl p-8 text-center"
            style={{ background:"rgba(12,14,18,0.88)", border:"1px solid rgba(200,60,60,0.25)", boxShadow:"0 0 40px rgba(200,60,60,0.08)" }}>
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
            <div className="relative metal-glow-card backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden"
              style={{ background: M.cardBg, border:`1px solid ${M.cardBorder}` }}>

              {/* カード上部のシルバーシマーライン */}
              <div className="absolute top-0 left-0 w-full h-px"
                style={{ background:"linear-gradient(90deg, transparent, rgba(200,210,230,0.6), rgba(240,244,250,0.9), rgba(200,210,230,0.6), transparent)" }} />
              {/* シマー光が流れる */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <div style={{
                  position:"absolute", top:0, left:"-10%", width:"14%", height:"100%",
                  background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
                  animation:"shimmer-slide 5s ease-in-out infinite",
                }} />
              </div>

              {/* ── STEP 1: 情報入力 ── */}
              {step === "input" && (
                <form onSubmit={handleEmployeeSubmit} className="flex flex-col gap-6">
                  <div>
                    <label className="block text-sm font-bold mb-3 tracking-wide" style={{ color: M.silverBrt }}>
                      <span style={{ color: M.silver, textShadow:`0 0 10px rgba(200,210,230,0.6)` }}>STEP 1</span>
                      <span className="text-slate-600 mx-2">/</span>
                      情報を入力
                    </label>
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-xs mb-1.5 tracking-wide" style={{ color: M.silverDim }}>あなたの所属している組</p>
                        {config.groups && config.groups.length > 0 ? (
                          <select
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full rounded-xl px-4 py-3 text-white outline-none transition-all text-sm sm:text-base"
                            style={{ background: M.inputBg, border:`1px solid ${M.inputBorder}` }}
                            onFocus={(e) => { e.currentTarget.style.border=`1px solid ${M.inputFocus}`; e.currentTarget.style.boxShadow=`0 0 18px rgba(200,210,230,0.25)`; }}
                            onBlur={(e)  => { e.currentTarget.style.border=`1px solid ${M.inputBorder}`; e.currentTarget.style.boxShadow="none"; }}
                          >
                            <option value="" style={{ background:"#111318", color:"#64748b" }}>-- 組を選択 --</option>
                            {config.groups.map((g) => (
                              <option key={g} value={g} style={{ background:"#111318", color:"#fff" }}>{g}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="例: 鷺組"
                            className="w-full rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-all text-sm sm:text-base"
                            style={{ background: M.inputBg, border:`1px solid ${M.inputBorder}` }}
                            onFocus={(e) => { e.currentTarget.style.border=`1px solid ${M.inputFocus}`; e.currentTarget.style.boxShadow=`0 0 18px rgba(200,210,230,0.25)`; }}
                            onBlur={(e)  => { e.currentTarget.style.border=`1px solid ${M.inputBorder}`; e.currentTarget.style.boxShadow="none"; }}
                            autoComplete="off"
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-xs mb-1.5 tracking-wide" style={{ color: M.silverDim }}>社員番号</p>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={employeeNumber}
                          onChange={(e) => setEmployeeNumber(normalizeEmployeeNumber(e.target.value))}
                          placeholder="例: 12345"
                          className="w-full rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-all text-sm sm:text-base"
                          style={{ background: M.inputBg, border:`1px solid ${M.inputBorder}` }}
                          onFocus={(e) => { e.currentTarget.style.border=`1px solid ${M.inputFocus}`; e.currentTarget.style.boxShadow=`0 0 18px rgba(200,210,230,0.25)`; }}
                          onBlur={(e)  => { e.currentTarget.style.border=`1px solid ${M.inputBorder}`; e.currentTarget.style.boxShadow="none"; }}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                  {error && (
                    <p className="text-red-400 text-sm bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
                  )}
                  <button
                    type="submit"
                    className="relative w-full overflow-hidden font-bold py-4 rounded-xl transition-all active:scale-95 text-base tracking-wide"
                    style={{ background: M.btnGrad, color:"#0f1117", boxShadow:"0 0 28px rgba(180,190,210,0.35), inset 0 1px 0 rgba(255,255,255,0.2)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = M.btnHover; e.currentTarget.style.boxShadow="0 0 45px rgba(200,210,230,0.55), inset 0 1px 0 rgba(255,255,255,0.25)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = M.btnGrad; e.currentTarget.style.boxShadow="0 0 28px rgba(180,190,210,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"; }}
                  >
                    次へ →
                  </button>
                </form>
              )}

              {/* ── STEP 2: 作品選択 ── */}
              {step === "select" && (
                <form onSubmit={handleSelectSubmit} className="flex flex-col gap-5">
                  <div>
                    <p className="text-xs mb-1" style={{ color: M.silverDim }}>
                      社員番号: <span className="font-mono" style={{ color: M.silver }}>{employeeNumber}</span>
                      　所属組: <span className="font-mono" style={{ color: M.silver }}>{groupName}</span>
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-sm font-bold tracking-wide" style={{ color: M.silverBrt }}>
                        <span style={{ color: M.silver, textShadow:`0 0 10px rgba(200,210,230,0.6)` }}>STEP 2</span>
                        <span className="text-slate-600 mx-2">/</span>
                        投票する作品を選択
                      </label>
                      <span
                        className="text-xs font-mono px-3 py-1 rounded-full border transition-all"
                        style={selectedIds.length === maxSel
                          ? { border:"1px solid rgba(160,210,160,0.6)", background:"rgba(160,210,160,0.08)", color:"#86efac", boxShadow:"0 0 10px rgba(130,200,130,0.25)" }
                          : { border:`1px solid rgba(120,130,150,0.4)`, background:"rgba(255,255,255,0.03)", color: M.silverDim }
                        }
                      >
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
                            className="relative flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 w-full overflow-hidden"
                            style={isSelected
                              ? { border:`2px solid ${M.selBorder}`, background: M.selBg, boxShadow: M.selGlow }
                              : isSameGroup
                              ? { border:"2px solid rgba(150,60,60,0.25)", background:"rgba(150,50,50,0.08)", opacity:0.38, cursor:"not-allowed" }
                              : isDisabled
                              ? { border:"2px solid rgba(80,85,100,0.4)", background:"rgba(0,0,0,0.3)", opacity:0.28, cursor:"not-allowed" }
                              : { border:`2px solid rgba(100,110,130,0.4)`, background:"rgba(255,255,255,0.02)", cursor:"pointer" }
                            }
                            onMouseEnter={(e) => {
                              if (!isSelected && !isDisabled) {
                                e.currentTarget.style.border=`2px solid rgba(160,170,190,0.55)`;
                                e.currentTarget.style.background="rgba(180,190,210,0.04)";
                                e.currentTarget.style.boxShadow="0 0 20px rgba(160,170,190,0.2)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected && !isDisabled) {
                                e.currentTarget.style.border=`2px solid rgba(100,110,130,0.4)`;
                                e.currentTarget.style.background="rgba(255,255,255,0.02)";
                                e.currentTarget.style.boxShadow="none";
                              }
                            }}
                          >
                            {/* 選択済みのキラキラライン */}
                            {isSelected && (
                              <div className="absolute top-0 left-0 w-full h-px"
                                style={{ background:"linear-gradient(90deg, transparent, rgba(220,228,245,0.8), transparent)" }} />
                            )}
                            <div
                              className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-sm font-bold transition-all"
                              style={isSelected
                                ? { borderRadius: maxSel===1?"50%":"8px", border:`2px solid ${M.selBorder}`, background:"rgba(200,210,230,0.18)", color: M.silverBrt, boxShadow:`0 0 14px rgba(200,210,230,0.5)` }
                                : { borderRadius: maxSel===1?"50%":"8px", border:"2px solid rgba(90,100,115,0.6)", color: M.silverDim }
                              }
                            >
                              {isSelected ? "✓" : String.fromCharCode(65 + index)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-base sm:text-lg font-mono leading-snug whitespace-pre-line transition-all"
                                style={{ color: isSelected ? M.silverBrt : M.silver, textShadow: isSelected ? `0 0 8px rgba(220,228,245,0.7)` : "none" }}>
                                {option.productNumber}
                              </p>
                              {option.description && option.description !== option.productNumber && (
                                <p className="text-xs mt-0.5 truncate" style={{ color: M.silverDim }}>{option.description}</p>
                              )}
                            </div>
                            {isSameGroup && (
                              <span className="flex-shrink-0 text-xs text-red-400/80 border border-red-800/40 rounded px-1.5 py-0.5 bg-red-950/30">同組</span>
                            )}
                            {isSelected && maxSel > 1 && (
                              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{ background:"rgba(200,210,230,0.2)", color: M.silverBrt, boxShadow:`0 0 10px rgba(200,210,230,0.45)`, border:`1px solid ${M.selBorder}` }}>
                                {selectedIds.indexOf(option.id) + 1}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setStep("input"); setSelectedIds([]); setError(""); }}
                      className="flex-1 font-medium py-3.5 rounded-xl transition-all active:scale-95"
                      style={{ background:"rgba(20,22,30,0.9)", border:`1px solid rgba(100,110,130,0.5)`, color: M.steel }}
                      onMouseEnter={(e) => { e.currentTarget.style.border=`1px solid rgba(160,170,190,0.6)`; e.currentTarget.style.color=M.silver; }}
                      onMouseLeave={(e) => { e.currentTarget.style.border=`1px solid rgba(100,110,130,0.5)`; e.currentTarget.style.color=M.steel; }}
                    >
                      ← 戻る
                    </button>
                    <button
                      type="submit"
                      disabled={selectedIds.length !== maxSel}
                      className="flex-1 font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: M.btnGrad, color:"#0f1117", boxShadow:"0 0 24px rgba(180,190,210,0.3), inset 0 1px 0 rgba(255,255,255,0.2)" }}
                      onMouseEnter={(e) => { if(selectedIds.length===maxSel){ e.currentTarget.style.background=M.btnHover; e.currentTarget.style.boxShadow="0 0 40px rgba(200,210,230,0.5), inset 0 1px 0 rgba(255,255,255,0.25)"; } }}
                      onMouseLeave={(e) => { e.currentTarget.style.background=M.btnGrad; e.currentTarget.style.boxShadow="0 0 24px rgba(180,190,210,0.3), inset 0 1px 0 rgba(255,255,255,0.2)"; }}
                    >
                      確認へ →
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 3: 確認 ── */}
              {step === "confirm" && (
                <div className="flex flex-col gap-6">
                  <h2 className="text-center font-bold text-sm tracking-widest uppercase" style={{ color: M.silverBrt }}>
                    <span style={{ color: M.silver, textShadow:`0 0 10px rgba(200,210,230,0.6)` }}>STEP 3</span>
                    <span className="text-slate-600 mx-2">/</span>
                    投票内容の確認
                  </h2>

                  <div className="rounded-xl p-5 space-y-4 shadow-inner"
                    style={{ background: M.innerBg, border:`1px solid ${M.innerBorder}` }}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: M.silverDim }}>社員番号</span>
                      <span className="font-mono font-bold text-lg" style={{ color: M.silverBrt }}>{employeeNumber}</span>
                    </div>
                    <div className="border-t" style={{ borderColor:"rgba(120,130,150,0.2)" }} />
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: M.silverDim }}>所属組</span>
                      <span className="font-mono font-bold" style={{ color: M.silverBrt }}>{groupName}</span>
                    </div>
                    <div className="border-t" style={{ borderColor:"rgba(120,130,150,0.2)" }} />
                    <div>
                      <span className="text-sm block mb-3" style={{ color: M.silverDim }}>投票作品 ({maxSel}択)</span>
                      <div className="flex flex-col gap-2">
                        {selectedOptions.map((opt, i) => (
                          <div key={opt.id} className="flex items-center gap-3 rounded-lg px-3 py-2"
                            style={{ background:"rgba(200,210,230,0.05)", border:`1px solid rgba(180,190,210,0.25)` }}>
                            {maxSel > 1 && (
                              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background:"rgba(200,210,230,0.15)", color: M.silver, border:`1px solid rgba(180,190,210,0.4)` }}>
                                {i + 1}
                              </span>
                            )}
                            <span className="font-mono font-bold text-base whitespace-pre-line leading-snug"
                              style={{ color: M.silverBrt, textShadow:`0 0 8px rgba(220,228,245,0.6)` }}>
                              {opt.productNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-xs rounded-lg py-2"
                    style={{ color:"rgba(240,180,80,0.85)", background:"rgba(100,70,10,0.25)", border:"1px solid rgba(200,150,40,0.2)" }}>
                    ⚠️ 一度投票すると変更できません
                  </p>

                  {error && (
                    <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStep("select"); setError(""); }}
                      disabled={loading}
                      className="flex-1 font-medium py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                      style={{ background:"rgba(20,22,30,0.9)", border:`1px solid rgba(100,110,130,0.5)`, color: M.steel }}
                      onMouseEnter={(e) => { e.currentTarget.style.border=`1px solid rgba(160,170,190,0.6)`; e.currentTarget.style.color=M.silver; }}
                      onMouseLeave={(e) => { e.currentTarget.style.border=`1px solid rgba(100,110,130,0.5)`; e.currentTarget.style.color=M.steel; }}
                    >
                      ← 戻る
                    </button>
                    <button
                      onClick={handleVote}
                      disabled={loading}
                      className="flex-1 font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-base"
                      style={{ background: M.btnGrad, color:"#0f1117", boxShadow:"0 0 28px rgba(180,190,210,0.35), inset 0 1px 0 rgba(255,255,255,0.2)" }}
                      onMouseEnter={(e) => { if(!loading){ e.currentTarget.style.background=M.btnHover; e.currentTarget.style.boxShadow="0 0 50px rgba(200,210,230,0.55), inset 0 1px 0 rgba(255,255,255,0.25)"; } }}
                      onMouseLeave={(e) => { e.currentTarget.style.background=M.btnGrad; e.currentTarget.style.boxShadow="0 0 28px rgba(180,190,210,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"; }}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor:"rgba(20,22,30,0.8)", borderTopColor:"transparent" }} />
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
                    <div className="absolute inset-0 rounded-full blur-2xl animate-pulse scale-150"
                      style={{ background:"rgba(180,190,210,0.18)" }} />
                    <div className="absolute inset-0 rounded-full scale-125 animate-ping"
                      style={{ border:`2px solid rgba(200,210,230,0.3)` }} />
                    <div
                      className="relative w-24 h-24 rounded-full flex items-center justify-center text-5xl check-pop-animation"
                      style={{
                        background:"linear-gradient(135deg, #3d4552, #8a96a8, #e8edf5, #8a96a8, #3d4552)",
                        boxShadow:"0 0 50px rgba(190,200,220,0.65)",
                        color: "#0f1117",
                      }}
                    >
                      ✓
                    </div>
                  </div>

                  <div>
                    <h2
                      className="text-3xl font-bold mb-1"
                      style={{
                        background:"linear-gradient(135deg, #94a3b8, #f1f5f9, #94a3b8)",
                        WebkitBackgroundClip:"text",
                        WebkitTextFillColor:"transparent",
                        backgroundClip:"text",
                      }}
                    >
                      投票完了！
                    </h2>
                    <p className="text-sm mb-5" style={{ color: M.silverDim }}>ご投票ありがとうございました</p>
                    <div className="flex flex-col gap-2">
                      {selectedOptions.map((opt, i) => (
                        <div key={opt.id} className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5"
                          style={{ background:"rgba(200,210,230,0.05)", border:`1px solid rgba(180,190,210,0.25)` }}>
                          {maxSel > 1 && (
                            <span className="text-xs font-mono" style={{ color: M.silverDim }}>{i + 1}.</span>
                          )}
                          <span className="font-mono font-bold text-xl whitespace-pre-line leading-snug"
                            style={{ color: M.silverBrt, textShadow:`0 0 12px rgba(220,228,245,0.7)` }}>
                            {opt.productNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs mt-3" style={{ color: M.silverDim }}>に投票しました</p>
                    <p className="text-xs mt-2 text-slate-700">※ 投票内容はこのブラウザに記録されました</p>
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
