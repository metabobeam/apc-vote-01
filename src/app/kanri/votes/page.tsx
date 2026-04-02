"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface VoteRecord {
  id: string;
  employeeNumber: string;
  groupName: string;
  productNumbers: string[];
  timestamp: string;
  isDuplicate: boolean;
}

export default function VoteManagePage() {
  const router = useRouter();

  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [filterDup, setFilterDup] = useState(false);

  const fetchVotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/votes");
      if (!res.ok) return;
      const data = await res.json();
      setVotes(data.votes);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setMsg("");
    try {
      const res = await fetch("/api/admin/votes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMsg("✓ 削除しました");
        await fetchVotes();
      } else {
        const d = await res.json();
        setMsg(`✗ ${d.error}`);
      }
    } catch {
      setMsg("✗ エラーが発生しました");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const duplicateCount = votes.filter((v) => v.isDuplicate).length;
  const displayed = filterDup ? votes.filter((v) => v.isDuplicate) : votes;

  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-start px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-rose-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-full px-3 py-1 mb-2">
              <span className="w-2 h-2 bg-rose-400 rounded-full" />
              <span className="text-rose-400 text-xs font-semibold tracking-widest">VOTE MANAGER</span>
            </div>
            <h1 className="text-2xl font-bold gradient-text">投票内容管理</h1>
          </div>
          <button
            onClick={() => router.push("/kanri")}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← 管理者へ
          </button>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-white font-mono">{total}</p>
            <p className="text-slate-400 text-xs mt-1">総投票数</p>
          </div>
          <div className={`bg-slate-900/80 border rounded-xl p-4 text-center ${duplicateCount > 0 ? "border-rose-500/40" : "border-slate-700/50"}`}>
            <p className={`text-3xl font-bold font-mono ${duplicateCount > 0 ? "text-rose-400" : "text-slate-400"}`}>
              {duplicateCount}
            </p>
            <p className="text-slate-400 text-xs mt-1">重複投票</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400 font-mono">{total - duplicateCount}</p>
            <p className="text-slate-400 text-xs mt-1">有効投票</p>
          </div>
        </div>

        {/* フィルター・操作 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setFilterDup(!filterDup)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              filterDup
                ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${filterDup ? "bg-rose-400" : "bg-slate-600"}`} />
            重複のみ表示 {duplicateCount > 0 && `(${duplicateCount}件)`}
          </button>
          {msg && (
            <p className={`text-sm font-medium ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
              {msg}
            </p>
          )}
          <button
            onClick={fetchVotes}
            disabled={loading}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            {loading ? "読込中..." : "↻ 更新"}
          </button>
        </div>

        {/* 投票一覧 */}
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
          {/* テーブルヘッダー */}
          <div className="grid grid-cols-[1fr_1.4fr_1.2fr_auto] gap-3 px-5 py-3 border-b border-slate-800 bg-slate-800/40">
            <span className="text-slate-500 text-xs">社員番号</span>
            <span className="text-slate-500 text-xs">投票作品</span>
            <span className="text-slate-500 text-xs">投票日時</span>
            <span className="text-slate-500 text-xs w-16 text-center">操作</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-4xl mb-3">📭</p>
              <p className="text-slate-400 text-sm">
                {filterDup ? "重複投票はありません" : "投票データがありません"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {displayed.map((vote) => (
                <div
                  key={vote.id}
                  className={`grid grid-cols-[1fr_1.4fr_1.2fr_auto] gap-3 px-5 py-3.5 items-center transition-colors ${
                    vote.isDuplicate ? "bg-rose-950/20 hover:bg-rose-950/30" : "hover:bg-slate-800/30"
                  }`}
                >
                  {/* 社員番号 + 組番号 */}
                  <div className="flex items-center gap-2 min-w-0">
                    {vote.isDuplicate && (
                      <span className="flex-shrink-0 text-xs bg-rose-500/20 border border-rose-500/40 text-rose-400 px-1.5 py-0.5 rounded font-bold">
                        重複
                      </span>
                    )}
                    <span className="font-mono text-sm text-slate-200 truncate">
                      {vote.employeeNumber}
                    </span>
                    {vote.groupName && (
                      <span className="flex-shrink-0 text-xs text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
                        {vote.groupName.slice(0, 3)}
                      </span>
                    )}
                  </div>

                  {/* 投票作品 */}
                  <div className="flex flex-wrap gap-1">
                    {vote.productNumbers.map((pn, i) => (
                      <span
                        key={i}
                        className="font-mono text-xs bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded"
                      >
                        {pn}
                      </span>
                    ))}
                  </div>

                  {/* 投票日時 */}
                  <span className="text-slate-500 text-xs font-mono">
                    {new Date(vote.timestamp).toLocaleString("ja-JP", {
                      month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </span>

                  {/* 削除ボタン */}
                  <div className="w-16 flex justify-center">
                    {confirmId === vote.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(vote.id)}
                          disabled={deletingId === vote.id}
                          className="text-xs bg-rose-700/60 hover:bg-rose-700 border border-rose-600 text-rose-200 px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                        >
                          {deletingId === vote.id ? "…" : "削除"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 px-2 py-1 rounded-lg transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(vote.id)}
                        className="text-xs text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/40 px-2 py-1 rounded-lg transition-all"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-slate-700 text-xs text-center mt-4">
          ※ 削除した投票は復元できません
        </p>
      </div>
    </main>
  );
}
