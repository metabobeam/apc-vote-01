"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { VoteStats } from "@/lib/types";
import { setResultsAuth, getResultsAuth, clearResultsAuth } from "@/lib/cookies";

interface PublicConfig {
  title: string;
  deadline: string;
  isActive: boolean;
}

export default function ResultsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [stats, setStats] = useState<VoteStats | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // セッション認証チェック
  useEffect(() => {
    if (getResultsAuth()) {
      setAuthed(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, configRes] = await Promise.all([
        fetch("/api/results"),
        fetch("/api/config"),
      ]);
      const [statsData, configData] = await Promise.all([
        statsRes.json(),
        configRes.json(),
      ]);
      setStats(statsData);
      setConfig(configData);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    setDataLoading(true);
    fetchData();
  }, [authed, fetchData]);

  useEffect(() => {
    if (!authed || !autoRefresh) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [authed, autoRefresh, fetchData]);

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
      } else {
        setAuthError("パスワードが正しくありません");
      }
    } catch {
      setAuthError("エラーが発生しました");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearResultsAuth();
    setAuthed(false);
    setPassword("");
    setStats(null);
  };

  const maxCount = stats ? Math.max(...stats.results.map((r) => r.count), 1) : 1;
  const winner = stats?.results[0];

  const rankColors = [
    "from-yellow-500 to-amber-500",
    "from-slate-400 to-slate-300",
    "from-orange-700 to-orange-600",
  ];
  const rankGlow = [
    "shadow-yellow-500/30",
    "shadow-slate-400/20",
    "shadow-orange-700/20",
  ];

  // ---- 認証画面 ----
  if (!authed) {
    return (
      <main className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-amber-600/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 mb-3">
              <span className="text-amber-400 text-xs font-semibold tracking-widest">RESULTS</span>
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-1">投票結果</h1>
            <p className="text-slate-500 text-sm">管理者パスワードで閲覧できます</p>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🔐</div>
              <p className="text-slate-400 text-sm">認証が必要です</p>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理者パスワード"
                className="w-full bg-slate-800/80 border border-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all"
                autoFocus
              />
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : "結果を見る"}
              </button>
            </form>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/")}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              ← 投票ページへ戻る
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---- データ読み込み中 ----
  if (dataLoading || !stats || !config) {
    return (
      <main className="min-h-screen grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm tracking-widest">LOADING...</p>
        </div>
      </main>
    );
  }

  // ---- 結果画面 ----
  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-start px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-amber-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 mb-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-amber-400 text-xs font-semibold tracking-widest uppercase">
                LIVE RESULTS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {config.title}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => router.push("/")}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← 投票へ
            </button>
            <button
              onClick={handleLogout}
              className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-white font-mono">{stats.totalVotes}</p>
            <p className="text-slate-400 text-xs mt-1">総投票数</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-indigo-300 font-mono">{stats.results.length}</p>
            <p className="text-slate-400 text-xs mt-1">選択肢数</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className={`text-xl font-bold font-mono ${config.isActive && new Date(config.deadline) > new Date() ? "text-green-400" : "text-red-400"}`}>
              {config.isActive && new Date(config.deadline) > new Date() ? "受付中" : "終了"}
            </p>
            <p className="text-slate-400 text-xs mt-1">ステータス</p>
          </div>
        </div>

        {/* Winner spotlight */}
        {stats.totalVotes > 0 && winner && winner.count > 0 && (
          <div className="bg-gradient-to-r from-amber-950/40 to-yellow-950/40 border border-amber-500/30 rounded-2xl p-6 mb-6 text-center shadow-lg shadow-amber-500/10">
            <p className="text-amber-400 text-xs font-semibold tracking-widest mb-2">CURRENT LEADER</p>
            <p className="text-4xl sm:text-5xl font-bold text-white font-mono mb-1">{winner.productNumber}</p>
            {winner.description !== winner.productNumber && (
              <p className="text-slate-400 text-sm mb-3">{winner.description}</p>
            )}
            <div className="flex items-center justify-center gap-3">
              <span className="text-amber-300 text-2xl font-bold">{winner.count}</span>
              <span className="text-slate-400 text-sm">票</span>
              <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-bold px-3 py-1 rounded-full">
                {winner.percentage}%
              </span>
            </div>
          </div>
        )}

        {/* Results list */}
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-slate-300 font-semibold text-sm tracking-wide mb-5 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-400 rounded-full" />
            得票数ランキング
            {stats.maxSelections > 1 && (
              <span className="text-slate-600 text-xs font-normal">({stats.maxSelections}択投票)</span>
            )}
          </h2>

          {stats.totalVotes === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-500 text-4xl mb-3">📭</p>
              <p className="text-slate-400">まだ投票がありません</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {stats.results.map((result, index) => (
                <div key={result.productId} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {index < 3 ? (
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${rankColors[index]} flex items-center justify-center text-xs font-bold text-white shadow-lg ${rankGlow[index]}`}>
                          {index + 1}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                          {index + 1}
                        </div>
                      )}
                      <div>
                        <p className="text-white font-bold font-mono">{result.productNumber}</p>
                        {result.description !== result.productNumber && (
                          <p className="text-slate-500 text-xs">{result.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold font-mono text-lg">{result.count}</span>
                      <span className="text-slate-400 text-xs ml-1">票</span>
                      <span className="ml-2 text-slate-400 text-sm">({result.percentage}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        index === 0
                          ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                          : index === 1
                          ? "bg-gradient-to-r from-slate-400 to-slate-300"
                          : "bg-gradient-to-r from-indigo-600 to-violet-500"
                      }`}
                      style={{
                        width: `${(result.count / maxCount) * 100}%`,
                        transition: "width 700ms ease-out",
                        willChange: "width",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto refresh toggle */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 transition-colors ${autoRefresh ? "text-green-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
            {autoRefresh ? "自動更新ON (5秒)" : "自動更新OFF"}
          </button>
          <span>最終更新: {new Date(stats.lastUpdated).toLocaleTimeString("ja-JP")}</span>
          <button onClick={fetchData} className="text-slate-500 hover:text-slate-300 transition-colors">
            ↻ 更新
          </button>
        </div>
      </div>
    </main>
  );
}
