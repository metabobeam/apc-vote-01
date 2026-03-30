"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { VoteStats, VoteResult } from "@/lib/types";
import { setResultsAuth, getResultsAuth } from "@/lib/cookies";

interface PublicConfig {
  title: string;
  deadline: string;
  isActive: boolean;
}

type Phase = "login" | "standby" | "revealing" | "complete";

const REVEAL_DURATION = 5000; // バーが伸びきるまでの時間 (ms)

// バーの色 (ABC順インデックスに対応)
const BAR_COLORS = [
  "from-indigo-500 to-indigo-400",
  "from-cyan-500 to-cyan-400",
  "from-violet-500 to-violet-400",
  "from-emerald-500 to-emerald-400",
  "from-rose-500 to-rose-400",
  "from-amber-500 to-amber-400",
  "from-sky-500 to-sky-400",
  "from-pink-500 to-pink-400",
];

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
  // ABC順ソート済み結果
  const [sortedResults, setSortedResults] = useState<VoteResult[]>([]);
  // 各バーの現在幅 (0〜100%)
  const [barWidths, setBarWidths] = useState<number[]>([]);
  // winner の productId（同点1位対応で複数）
  const [winnerProductIds, setWinnerProductIds] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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
      // ABC順に並べる
      const sorted = [...statsData.results].sort((a, b) =>
        a.productNumber.localeCompare(b.productNumber, "ja")
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

    // 全バーを同時にスタート (わずかに遅延させてCSSトランジション確実に開始)
    const t = setTimeout(() => {
      setBarWidths(
        sortedResults.map((r) => (r.count / maxCount) * 100)
      );
    }, 60);
    timersRef.current.push(t);

    // 5秒後に完了フェーズへ
    const t2 = setTimeout(() => {
      const maxCount = Math.max(...sortedResults.map((r) => r.count));
      const winners = sortedResults
        .filter((r) => r.count === maxCount && r.count > 0)
        .map((r) => r.productId);
        setWinnerProductIds(winners);
      setPhase("complete");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }, REVEAL_DURATION + 300);
    timersRef.current.push(t2);
  };

  const reset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPhase("standby");
    setWinnerProductIds([]);
    setShowConfetti(false);
    setBarWidths(new Array(sortedResults.length).fill(0));
  };

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  // ---- ログイン ----
  if (!authed) {
    return (
      <main className="min-h-screen grid-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-full px-3 py-1 mb-3">
              <span className="text-violet-400 text-xs font-semibold tracking-widest">ANNOUNCE</span>
            </div>
            <h1 className="text-2xl font-bold gradient-text">結果発表</h1>
            <p className="text-slate-500 text-sm mt-1">管理者パスワードで入室できます</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-slate-400 text-sm">認証が必要です</p>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理者パスワード"
                autoFocus
                className="w-full bg-slate-800/80 border border-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all"
              />
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
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
            <button onClick={() => router.push("/")} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              ← 投票ページへ戻る
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (dataLoading || !stats || !config) {
    return (
      <main className="min-h-screen grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm tracking-widest">LOADING...</p>
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-[#020817] grid-bg flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* 背景グロー */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      {/* 紙吹雪 */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 36 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-full px-4 py-1.5 mb-4">
            <span className={`w-2 h-2 rounded-full ${phase === "revealing" ? "bg-violet-400 animate-ping" : "bg-violet-400"}`} />
            <span className="text-violet-400 text-xs font-semibold tracking-widest uppercase">
              {phase === "standby" ? "READY TO ANNOUNCE" : phase === "revealing" ? "REVEALING..." : "RESULT ANNOUNCED"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold gradient-text mb-2">{config.title}</h1>
          <p className="text-slate-500 text-sm">
            総投票数:&nbsp;<span className="text-slate-300 font-mono font-bold">{stats.totalVotes}</span>&nbsp;票
          </p>
        </div>

        {/* ── バーグラフパネル ── */}
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">

          {/* 列ヘッダー */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <span className="text-slate-600 text-xs w-28 sm:w-36 flex-shrink-0">商品番号</span>
            <span className="text-slate-600 text-xs flex-1">← 得票数</span>
            <span className="text-slate-600 text-xs w-20 text-right">票数 / %</span>
          </div>

          {/* バー行 */}
          <div className="flex flex-col gap-4">
            {sortedResults.map((result, index) => {
              const isWinner = phase === "complete" && winnerProductIds.includes(result.productId);
              const barW = barWidths[index] ?? 0;
              const color = BAR_COLORS[index % BAR_COLORS.length];

              return (
                <div key={result.productId} className="flex items-center gap-3">
                  {/* 商品番号ラベル (サイズ固定・レイアウト変化なし) */}
                  <div className="w-28 sm:w-36 flex-shrink-0 relative">
                    <span className="font-mono font-bold text-sm sm:text-base text-slate-200">
                      {result.productNumber}
                    </span>
                    {/* 勝者マークは absolute で配置してレイアウトに影響させない */}
                    {isWinner && (
                      <span className="absolute -top-3 left-0 text-xs animate-bounce pointer-events-none">🏆</span>
                    )}
                  </div>

                  {/* バートラック + 表示ボタン */}
                  <div className="flex-1 relative">
                    {/* トラック背景 (常に同じ背景色) */}
                    <div className="h-9 sm:h-11 rounded-r-xl overflow-visible relative bg-slate-800/70">
                      {/* 伸びるバー (色はアニメーション中も完了後も同じ) */}
                      <div
                        className={`absolute inset-y-0 left-0 rounded-r-xl bg-gradient-to-r ${color} ${
                          isWinner ? "shadow-[0_0_18px_rgba(99,102,241,0.4)]" : ""
                        }`}
                        style={{
                          width: `${barW}%`,
                          transition: phase === "revealing" || phase === "complete"
                            ? `width ${REVEAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`
                            : "none",
                        }}
                      >
                        {/* スキャンライン (アニメーション中のみ) */}
                        {phase === "revealing" && barW > 3 && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[scan_1.8s_ease-in-out_infinite]" />
                        )}
                      </div>

                      {/* 0軸ライン */}
                      <div className="absolute left-0 inset-y-0 w-0.5 bg-slate-500/60 z-10" />
                    </div>

                  </div>

                  {/* 票数 / % (サイズ固定) */}
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className="font-mono font-bold text-sm sm:text-base text-slate-200">
                      {result.count}
                    </span>
                    <span className="text-slate-600 text-xs ml-0.5">票</span>
                    <div className="text-xs font-mono text-slate-500">
                      {result.percentage}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 表示ボタン行（常にレンダリングして高さを固定・visibility で表示切り替え）*/}
          <div
            className="mt-5 flex items-center gap-3"
            style={{ visibility: phase === "standby" ? "visible" : "hidden" }}
          >
            <div className="w-28 sm:w-36 flex-shrink-0" />
            <div className="flex-1 flex items-center gap-3">
              <button
                onClick={startReveal}
                className="flex items-center gap-2
                  bg-gradient-to-r from-violet-600 to-indigo-600
                  hover:from-violet-500 hover:to-indigo-500
                  text-white font-bold text-base sm:text-lg
                  px-6 py-2.5 rounded-xl
                  shadow-lg shadow-violet-500/40
                  transition-all active:scale-95"
              >
                <PlayIcon />
                表示
              </button>
              <span className="text-slate-600 text-xs">← ボタンを押すと発表が始まります</span>
            </div>
            <div className="w-20 flex-shrink-0" />
          </div>

        </div>

        {/* 完了後ボタン（常にレンダリング・visibility で表示切り替え）*/}
        <div
          className="flex justify-center gap-3 mt-6"
          style={{ visibility: phase === "complete" ? "visible" : "hidden" }}
        >
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-all"
          >
            ↩ もう一度
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-all"
          >
            管理者へ
          </button>
        </div>

        {/* フッター */}
        <div className="mt-6 flex justify-center gap-6">
          <button onClick={() => router.push("/")} className="text-slate-700 hover:text-slate-400 text-xs transition-colors">
            ← 投票ページ
          </button>
          <span className="text-slate-800">|</span>
          <button onClick={() => router.push("/admin")} className="text-slate-700 hover:text-slate-400 text-xs transition-colors">
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

function ConfettiParticle({ index }: { index: number }) {
  const colors = ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#eab308", "#3b82f6"];
  const color = colors[index % colors.length];
  const left = `${(index * 31 + 5) % 100}%`;
  const delay = `${(index * 0.13) % 2.5}s`;
  const duration = `${2.5 + (index % 4) * 0.4}s`;
  const size = index % 3 === 0 ? "w-2 h-2" : index % 3 === 1 ? "w-1.5 h-3" : "w-2.5 h-1.5";
  const rotate = ["rotate-0", "rotate-45", "-rotate-12", "rotate-12"][index % 4];

  return (
    <div
      className={`absolute top-0 ${size} ${rotate} rounded-sm`}
      style={{ left, backgroundColor: color, animation: `confettiFall ${duration} ${delay} ease-in forwards` }}
    />
  );
}
