"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { VoteStats, VoteResult } from "@/lib/types";
import { setResultsAuth, getResultsAuth } from "@/lib/cookies";

interface PublicConfig {
  title: string;
  deadline: string;
  isActive: boolean;
  options: { id: string; productNumber: string; description: string }[];
}

type Phase = "login" | "standby" | "revealing" | "complete";

const REVEAL_DURATION = 10000; // バーが伸びきるまでの時間 (ms)

// アニメーション中: 全て青。完了後: 1位=赤、2位=オレンジ赤、他=青
const BAR_BLUE  = "from-blue-500 to-blue-400";
const BAR_RED1  = "from-red-600 to-rose-500";   // 1位
const BAR_RED2  = "from-orange-500 to-red-400"; // 2位

export default function AnnouncePage() {
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [stats, setStats] = useState<VoteStats | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [phase, setPhase] = useState<Phase>("login");
  // 設定画面と同じ順序でソートした結果
  const [sortedResults, setSortedResults] = useState<VoteResult[]>([]);
  // 各バーの現在幅 (0〜100%)
  const [barWidths, setBarWidths] = useState<number[]>([]);
  // アニメーション中の「現在の表示票数上限」（リアルタイムカウントアップ用）
  const [displayCap, setDisplayCap] = useState(0);
  // 1位・2位の productId（同点対応）
  const [winnerProductIds, setWinnerProductIds] = useState<string[]>([]);
  const [secondProductIds, setSecondProductIds] = useState<string[]>([]);
  // バー色・アイコン切り替えフラグ（2位先、1位後）
  const [revealedRank2, setRevealedRank2] = useState(false);
  const [revealedRank1, setRevealedRank1] = useState(false);
  // 1位発表時の全画面フラッシュ
  const [showRank1Flash, setShowRank1Flash] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (getResultsAuth()) {
      setAuthed(true);
      setPhase("standby");
    }
  }, []);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [statsRes, configRes] = await Promise.all([
        fetch("/api/results"),
        fetch("/api/config"),
      ]);
      const [statsData, configData]: [VoteStats, PublicConfig] = await Promise.all([
        statsRes.json(),
        configRes.json(),
      ]);
      setStats(statsData);
      setConfig(configData);
      // 設定画面と同じ並び順（config.options の順）でソート
      const optionOrder = configData.options.map((o) => o.id);
      const sorted = [...statsData.results].sort(
        (a, b) => optionOrder.indexOf(a.productId) - optionOrder.indexOf(b.productId)
      );
      setSortedResults(sorted);
      setBarWidths(new Array(sorted.length).fill(0));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setResultsAuth();
        setAuthed(true);
        setPhase("standby");
      } else {
        setAuthError("パスワードが正しくありません");
      }
    } catch {
      setAuthError("エラーが発生しました");
    } finally {
      setAuthLoading(false);
    }
  };

  const maxCount = useMemo(
    () => Math.max(...sortedResults.map((r) => r.count), 1),
    [sortedResults]
  );

  const startReveal = () => {
    if (!sortedResults.length) return;
    setPhase("revealing");

    // 絶対値ドリブン: 全バーが同じ「票数/秒」で伸びる → 誰が勝つかわからない
    const mc = maxCount;
    const results = sortedResults; // クロージャキャプチャ
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / REVEAL_DURATION, 1);
      // 現時点で「表示できる最大票数」= 全バー共通の絶対値上限
      const cap = progress * mc;
      setDisplayCap(cap);
      setBarWidths(
        results.map((r) => (Math.min(r.count, cap) / mc) * 100)
      );
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);

    // REVEAL_DURATION 後: 完了処理
    const t2 = setTimeout(() => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      setDisplayCap(mc);
      setBarWidths(results.map((r) => (r.count / mc) * 100));

      const winners = results
        .filter((r) => r.count === mc && r.count > 0)
        .map((r) => r.productId);
      // 同点1位が複数いる場合は2位を表示しない
      const rank2Count = winners.length === 1
        ? Math.max(...results.filter((r) => r.count < mc).map((r) => r.count), 0)
        : 0;
      const seconds = rank2Count > 0
        ? results.filter((r) => r.count === rank2Count).map((r) => r.productId)
        : [];
      setWinnerProductIds(winners);
      setSecondProductIds(seconds);
      setPhase("complete");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 30000);
    }, REVEAL_DURATION + 300);
    timersRef.current.push(t2);

    // 2位を先に発表
    const t3 = setTimeout(() => setRevealedRank2(true), REVEAL_DURATION + 800);
    timersRef.current.push(t3);
    // 1位フラッシュ（2位の約2秒後）
    const t4 = setTimeout(() => {
      setShowRank1Flash(true);
      setTimeout(() => setShowRank1Flash(false), 2000);
    }, REVEAL_DURATION + 2600);
    timersRef.current.push(t4);
    // 1位アイコン・バー色（フラッシュ直後）
    const t5 = setTimeout(() => setRevealedRank1(true), REVEAL_DURATION + 2800);
    timersRef.current.push(t5);
  };

  const reset = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPhase("standby");
    setDisplayCap(0);
    setWinnerProductIds([]);
    setSecondProductIds([]);
    setRevealedRank2(false);
    setRevealedRank1(false);
    setShowRank1Flash(false);
    setShowConfetti(false);
    setBarWidths(new Array(sortedResults.length).fill(0));
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // ---- ログイン ----
  if (!authed) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-violet-100 border border-violet-200 rounded-full px-3 py-1 mb-3">
              <span className="text-violet-600 text-xs font-semibold tracking-widest">ANNOUNCE</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">結果発表</h1>
            <p className="text-gray-500 text-sm mt-1">管理者パスワードで入室できます</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-gray-500 text-sm">認証が必要です</p>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理者パスワード"
                autoFocus
                className="w-full bg-white border border-gray-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition-all"
              />
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {authLoading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "入室する"}
              </button>
            </form>
          </div>
          <div className="mt-4 text-center">
            <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
              ← 投票ページへ戻る
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (dataLoading || !stats || !config) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm tracking-widest">LOADING...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="w-screen h-screen overflow-hidden flex flex-col"
      style={{
        backgroundImage: "url('/announce-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 1位発表フラッシュ */}
      {showRank1Flash && (
        <div
          className="fixed inset-0 z-[100] pointer-events-none"
          style={{ backgroundColor: "white", animation: "screenFlash 2s ease-out forwards" }}
        />
      )}

      {/* 桜吹雪 */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 160 }).map((_, i) => (
            <SakuraPetal key={i} index={i} />
          ))}
        </div>
      )}

      {/* ── ヘッダーエリア (約20vh) ── */}
      <div className="flex-shrink-0 flex flex-col items-center justify-end pb-4 pt-4" style={{ height: "20vh" }}>
        {/* ステータスバッジ */}
        <div
          className="inline-flex items-center gap-3 rounded-full px-6 py-2 mb-3 border border-pink-300/60"
          style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(12px)", boxShadow: "0 0 24px rgba(255,182,193,0.4)" }}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${phase === "revealing" ? "bg-pink-400 animate-ping" : "bg-pink-400"}`} />
          <span className="font-bold tracking-[0.3em] uppercase" style={{ fontSize: "clamp(11px,1vw,14px)", color: "#9d174d" }}>
            {phase === "standby" ? "READY TO ANNOUNCE" : phase === "revealing" ? "REVEALING..." : "RESULT ANNOUNCED"}
          </span>
        </div>

        {/* タイトル */}
        <h1
          className="font-black tracking-tight leading-none"
          style={{
            fontSize: "clamp(2rem,4.5vw,5rem)",
            color: "#ffffff",
            textShadow: "0 0 40px rgba(255,100,150,0.9), 0 0 20px rgba(255,150,180,0.6), 0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {config.title}
        </h1>

        {/* 総投票数 */}
        <p className="tracking-widest mt-1" style={{ fontSize: "clamp(11px,0.9vw,14px)", color: "rgba(100,30,80,0.7)" }}>
          TOTAL&nbsp;
          <span
            className="font-black font-mono"
            style={{ fontSize: "clamp(18px,1.8vw,28px)", color: "#be185d", textShadow: "0 0 12px rgba(255,182,193,0.7)" }}
          >
            {stats.totalVotes}
          </span>
          &nbsp;VOTES
        </p>
      </div>

      {/* ── グラフエリア (約72vh) ── */}
      <div className="flex-1 flex items-stretch px-12 pb-2" style={{ minHeight: 0 }}>
        <div
          className="w-full rounded-3xl flex flex-col"
          style={{
            background: "linear-gradient(135deg, rgba(255,240,245,0.82) 0%, rgba(255,228,238,0.88) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,182,193,0.5)",
            boxShadow: "0 0 60px rgba(255,182,193,0.3), inset 0 1px 0 rgba(255,255,255,0.8)",
            padding: "clamp(16px,2vh,32px) clamp(20px,2.5vw,48px)",
          }}
        >
          {/* 列ヘッダー */}
          <div
            className="flex items-center gap-4 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(219,112,147,0.2)", paddingBottom: "clamp(8px,1vh,14px)", marginBottom: "clamp(8px,1vh,14px)" }}
          >
            <span className="tracking-widest flex-shrink-0" style={{ fontSize: "clamp(10px,0.75vw,12px)", width: "clamp(90px,11vw,180px)", color: "rgba(157,23,77,0.6)" }}>お題</span>
            <span className="uppercase tracking-widest flex-1" style={{ fontSize: "clamp(10px,0.75vw,12px)", color: "rgba(157,23,77,0.6)" }}>← VOTES</span>
            <span
              className="uppercase tracking-widest text-right flex-shrink-0 transition-opacity duration-700"
              style={{ fontSize: "clamp(10px,0.75vw,12px)", width: "clamp(140px,16vw,240px)", color: "rgba(157,23,77,0.6)", opacity: phase === "standby" ? 0 : 1 }}
            >COUNT</span>
          </div>

          {/* バー行 */}
          <div className="flex flex-col flex-1 justify-evenly" style={{ gap: "clamp(4px,0.8vh,12px)" }}>
            {sortedResults.map((result, index) => {
              const isRank1 = winnerProductIds.includes(result.productId);
              const isRank2 = secondProductIds.includes(result.productId);
              const barW = barWidths[index] ?? 0;
              // アニメーション中は現在の displayCap に合わせた票数を表示
              const shownCount = phase === "revealing"
                ? Math.min(result.count, Math.round(displayCap))
                : result.count;

              // バー色: 2位→1位の順で変化
              const color = revealedRank1 && isRank1 ? BAR_RED1
                          : revealedRank2 && isRank2 ? BAR_RED2
                          : BAR_BLUE;

              // ランク発表アニメーション
              const revealAnim = (revealedRank1 && isRank1) || (revealedRank2 && isRank2)
                ? "animate-[rankReveal_8s_ease-out_forwards]"
                : "";
              const pulseAnim = (revealedRank1 && isRank1) || (revealedRank2 && isRank2)
                ? "animate-[rankPulse_8s_ease-out_forwards]"
                : "";

              return (
                <div key={result.productId} className="flex items-center gap-4 flex-1" style={{ minHeight: 0 }}>

                  {/* 商品番号（改行対応） */}
                  <div className="flex-shrink-0 flex flex-col justify-center" style={{ width: "clamp(90px,11vw,180px)" }}>
                    {result.productNumber.split("\n").map((line, li) => (
                      <span
                        key={li}
                        className="font-mono font-black tracking-widest block leading-tight"
                        style={{
                          fontSize: li === 0 ? "clamp(14px,1.4vw,22px)" : "clamp(11px,1vw,16px)",
                          color: revealedRank1 && isRank1 ? "#7f1d1d"
                               : revealedRank2 && isRank2 ? "#7c2d12"
                               : "#4a1942",
                          textShadow: revealedRank1 && isRank1 ? "0 0 16px rgba(239,68,68,0.7)"
                                    : revealedRank2 && isRank2 ? "0 0 12px rgba(249,115,22,0.6)"
                                    : "none",
                        }}
                      >
                        {line}
                      </span>
                    ))}
                  </div>

                  {/* バートラック */}
                  <div className={`flex-1 relative ${pulseAnim}`} style={{ minHeight: 0 }}>
                    <div
                      className="rounded-r-2xl overflow-visible relative w-full"
                      style={{
                        height: "clamp(28px,4.5vh,56px)",
                        background: "rgba(255,255,255,0.4)",
                        border: revealedRank1 && isRank1 ? "1px solid rgba(239,68,68,0.4)"
                               : revealedRank2 && isRank2 ? "1px solid rgba(249,115,22,0.3)"
                               : "1px solid rgba(219,112,147,0.25)",
                      }}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 rounded-r-2xl bg-gradient-to-r ${color} ${revealAnim}`}
                        style={{
                          width: `${barW}%`,
                          boxShadow: revealedRank1 && isRank1
                            ? "0 0 28px rgba(239,68,68,0.7), 0 0 10px rgba(255,255,255,0.4)"
                            : revealedRank2 && isRank2
                            ? "0 0 20px rgba(249,115,22,0.6)"
                            : barW > 0 ? "0 0 10px rgba(59,130,246,0.4)" : "none",
                        }}
                      >
                        {phase === "revealing" && barW > 3 && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[scan_1.8s_ease-in-out_infinite]" />
                        )}
                      </div>
                      <div className="absolute left-0 inset-y-0 w-px bg-pink-400/40 z-10" />
                    </div>
                  </div>

                  {/* トロフィー＋票数の複合列（revealing / complete で表示） */}
                  <div
                    className="flex-shrink-0 flex items-center gap-2 transition-opacity duration-500"
                    style={{
                      width: "clamp(140px,16vw,240px)",
                      opacity: phase === "standby" ? 0 : 1,
                    }}
                  >
                    {/* トロフィー（投票数の左側） */}
                    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: "clamp(54px,6.5vw,100px)" }}>
                      {/* 2位: 先に登場・控えめ演出 */}
                      {revealedRank2 && isRank2 && (
                        <span
                          className="inline-block"
                          style={{
                            fontSize: "clamp(54px,6vw,96px)",
                            animation: "rank2Drop 1.1s ease-out forwards, trophyFloat 2.5s ease-in-out 1.3s infinite",
                            filter: "drop-shadow(0 0 10px rgba(192,192,192,0.8))",
                          }}
                        >🥈</span>
                      )}
                      {/* 1位: 後から登場・最大限大げさ */}
                      {revealedRank1 && isRank1 && (
                        <span
                          className="inline-block"
                          style={{
                            fontSize: "clamp(54px,6vw,96px)",
                            animation: "rank1Drop 2.2s ease-out forwards, trophy1Float 1.8s ease-in-out 2.4s infinite",
                            filter: "drop-shadow(0 0 18px rgba(255,215,0,1))",
                          }}
                        >🥇</span>
                      )}
                    </div>
                    {/* 票数・% */}
                    <div className="text-right flex-1">
                      <span
                        className="font-mono font-black"
                        style={{
                          fontSize: "clamp(24px,2.4vw,40px)",
                        color: revealedRank1 && isRank1 ? "#991b1b"
                             : revealedRank2 && isRank2 ? "#9a3412"
                             : "#be185d",
                        textShadow: revealedRank1 && isRank1 ? "0 0 12px rgba(239,68,68,0.6)" : "none",
                        }}
                      >
                        {shownCount}
                      </span>
                      <span style={{ fontSize: "clamp(10px,0.7vw,12px)", color: "rgba(157,23,77,0.5)", marginLeft: "2px" }}>票</span>
                      <div className="font-mono" style={{ fontSize: "clamp(10px,0.75vw,12px)", color: "rgba(157,23,77,0.4)" }}>
                        {result.percentage}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 表示ボタン行 */}
          <div
            className="flex-shrink-0 flex items-center gap-4"
            style={{
              visibility: phase === "standby" ? "visible" : "hidden",
              marginTop: "clamp(8px,1.2vh,20px)",
              paddingTop: "clamp(8px,1vh,14px)",
              borderTop: "1px solid rgba(219,112,147,0.2)",
            }}
          >
            <div className="flex-shrink-0" style={{ width: "clamp(90px,11vw,180px)" }} />
            <div className="flex-1 flex items-center gap-5">
              <button
                onClick={startReveal}
                className="flex items-center gap-3 font-black rounded-2xl transition-all active:scale-95"
                style={{
                  fontSize: "clamp(14px,1.4vw,22px)",
                  padding: "clamp(10px,1.2vh,16px) clamp(24px,2.5vw,40px)",
                  background: "linear-gradient(135deg, #ec4899, #db2777)",
                  color: "#fff",
                  boxShadow: "0 0 24px rgba(236,72,153,0.6), 0 0 48px rgba(219,39,119,0.3), inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
              >
                <PlayIcon />
                結果発表
              </button>
            </div>
            <div className="flex-shrink-0" style={{ width: "clamp(140px,16vw,240px)" }} />
          </div>
        </div>
      </div>

      {/* ── フッターエリア (約10vh) ── */}
      <div className="flex-shrink-0 flex items-center justify-center gap-6" style={{ height: "10vh" }}>
        {/* 完了後ボタン */}
        <div style={{ visibility: phase === "complete" ? "visible" : "hidden" }} className="flex gap-4">
          <button
            onClick={reset}
            className="font-medium rounded-xl border transition-all"
            style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(219,112,147,0.4)", color: "#9d174d", fontSize: "clamp(12px,1vw,16px)", padding: "clamp(8px,1vh,12px) clamp(20px,2vw,32px)" }}
          >
            ↩ もう一度
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="font-medium rounded-xl border transition-all"
            style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(219,112,147,0.4)", color: "#9d174d", fontSize: "clamp(12px,1vw,16px)", padding: "clamp(8px,1vh,12px) clamp(20px,2vw,32px)" }}
          >
            管理者へ
          </button>
        </div>

        {/* フッターリンク */}
        <div className="flex gap-5">
          <button onClick={() => router.push("/")} className="transition-colors" style={{ fontSize: "clamp(10px,0.75vw,12px)", color: "rgba(157,23,77,0.4)" }}>
            ← 投票ページ
          </button>
          <span style={{ fontSize: "clamp(10px,0.75vw,12px)", color: "rgba(157,23,77,0.2)" }}>|</span>
          <button onClick={() => router.push("/admin")} className="transition-colors" style={{ fontSize: "clamp(10px,0.75vw,12px)", color: "rgba(157,23,77,0.4)" }}>
            管理者
          </button>
        </div>
      </div>
    </main>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <polygon points="2,1 13,7 2,13" />
    </svg>
  );
}

function SakuraPetal({ index }: { index: number }) {
  // 桜の花びら系のピンク・白系カラー
  const colors = ["#ffb7c5", "#ffc8d5", "#ffaec9", "#ff9eb5", "#ffd1dc", "#ffccd5", "#ff85a1", "#ffe0e8", "#f9a8c0", "#fdb8c8"];
  const color = colors[index % colors.length];
  const left = `${(index * 37 + 3) % 100}%`;
  // ペタルごとにディレイをばらつかせて自然な花吹雪に
  const delay = `${(index * 0.19) % 5}s`;
  // 落下時間: 10 〜 17.2s
  const duration = `${10 + (index % 5) * 1.8}s`;
  // 花びら形状のバリエーション（3倍サイズ）
  const shapes = [
    { w: 36, h: 21, br: "60% 40% 60% 40% / 70% 70% 30% 30%" },
    { w: 27, h: 36, br: "40% 60% 40% 60% / 30% 30% 70% 70%" },
    { w: 42, h: 24, br: "50% 50% 40% 60% / 60% 40% 60% 40%" },
    { w: 30, h: 30, br: "60% 40% 50% 50% / 50% 60% 40% 50%" },
    { w: 33, h: 18, br: "70% 30% 70% 30% / 60% 60% 40% 40%" },
  ];
  const shape = shapes[index % shapes.length];

  return (
    <div
      className="absolute top-0"
      style={{
        left,
        width: `${shape.w}px`,
        height: `${shape.h}px`,
        backgroundColor: color,
        borderRadius: shape.br,
        opacity: 0.9,
        animation: `sakuraFall ${duration} ${delay} ease-in-out forwards`,
        filter: `drop-shadow(0 0 3px rgba(255,150,180,0.5))`,
      }}
    />
  );
}
