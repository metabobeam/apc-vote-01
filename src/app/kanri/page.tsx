"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductOption, VoteStats } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { getResultsAuth, setResultsAuth, clearResultsAuth, saveAdminPass, getAdminPass } from "@/lib/cookies";

interface Config {
  title: string;
  deadline: string;
  options: ProductOption[];
  isActive: boolean;
  maxSelections: number;
  judges: string[];
  groups: string[];
}

interface JudgeData {
  judges: string[];
  candidates: { productId: string; productNumber: string; description: string; count: number }[];
  judgeVotes: { judgeName: string; selectedProductId: string }[];
  results: { productId: string; productNumber: string; description: string; judgeVoteCount: number }[];
}

interface ReviewTarget {
  id: string;
  name: string;
}

interface ReviewResult {
  productId: string;
  productNumber: string;
  totalScore: number;
  avgScore: number;
  reviewCount: number;
  scores: { judgeName: string; criterion1: number; criterion2: number; criterion3: number; total: number }[];
}

interface ReviewData {
  judges: string[];
  targets: ReviewTarget[];
  criteriaLabels: [string, string, string];
  results: ReviewResult[];
  judgeProgress: Record<string, string[]>;
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

  const [groups, setGroups] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  const [judges, setJudges] = useState<string[]>([]);
  const [newJudgeName, setNewJudgeName] = useState("");
  const [judgeData, setJudgeData] = useState<JudgeData | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [restoreMsg, setRestoreMsg] = useState("");
  const [restoring, setRestoring] = useState(false);

  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewResetConfirm, setReviewResetConfirm] = useState<string | null>(null);
  const [reviewResetting, setReviewResetting] = useState(false);
  const [reviewTargets, setReviewTargets] = useState<ReviewTarget[]>([]);
  const [newTargetName, setNewTargetName] = useState("");
  const [criteriaLabels, setCriteriaLabels] = useState<[string, string, string]>(["", "", ""]);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const [voteStats, setVoteStats] = useState<VoteStats | null>(null);

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
    setGroups(data.groups ?? []);
    setJudges(data.judges ?? []);
    fetchJudgeData();
    fetchReviewData();
    fetchVoteResults();
  };

  const fetchJudgeData = async () => {
    try {
      const res = await fetch("/api/judge");
      if (res.ok) setJudgeData(await res.json());
    } catch { /* ignore */ }
  };

  const fetchVoteResults = async () => {
    try {
      const res = await fetch("/api/results");
      if (res.ok) setVoteStats(await res.json());
    } catch { /* ignore */ }
  };

  const fetchReviewData = async () => {
    try {
      const res = await fetch("/api/review");
      if (res.ok) {
        const d: ReviewData = await res.json();
        setReviewData(d);
        setReviewTargets(d.targets ?? []);
        if (d.criteriaLabels) setCriteriaLabels(d.criteriaLabels);
      }
    } catch { /* ignore */ }
  };

  const saveReviewTargets = async (targets: ReviewTarget[]) => {
    try {
      await fetch("/api/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, targets }),
      });
    } catch { /* ignore */ }
  };

  const saveCriteriaLabels = async (labels: [string, string, string]) => {
    try {
      await fetch("/api/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, criteriaLabels: labels }),
      });
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

  // 組リストを即時保存
  const saveGroups = async (newGroups: string[]) => {
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, groups: newGroups }),
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

  const handleReviewReset = async (target: string) => {
    setReviewResetting(true);
    try {
      const body = target === "all"
        ? { clearAll: true, password }
        : { judgeName: target, password };
      const res = await fetch("/api/review", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveMsg("✓ 討議班審査データをリセットしました");
        fetchReviewData();
      } else {
        const d = await res.json();
        setSaveMsg(`✗ ${d.error ?? "削除に失敗しました"}`);
      }
    } catch {
      setSaveMsg("✗ 削除に失敗しました");
    } finally {
      setReviewResetting(false);
      setReviewResetConfirm(null);
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
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-gray-400 font-mono tracking-widest">Ver 0.9.2</span>
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
          {/* ── Topへボタン（右下固定） ── */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              position: "fixed", bottom: "24px", right: "24px", zIndex: 100,
              background: "#4f46e5", color: "#fff",
              border: "none", borderRadius: "50%",
              width: "44px", height: "44px",
              fontSize: "18px", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(79,70,229,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s, transform 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#4338ca"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#4f46e5"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            title="Topへ"
          >
            ↑
          </button>

          {/* ── 固定ナビゲーションメニュー ── */}
          <nav style={{
            position: "sticky", top: 0, zIndex: 50,
            background: "rgba(249,250,251,0.95)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid #e5e7eb",
            marginLeft: "-1rem", marginRight: "-1rem",
            padding: "8px 16px",
            display: "flex", gap: "6px", flexWrap: "wrap",
            marginBottom: "8px",
          }}>
            {[
              { href: "#sec-basic",   label: "⚙️ 基本設定" },
              { href: "#sec-group",   label: "🏠 組管理" },
              { href: "#sec-options", label: "📝 発表お題" },
              { href: "#sec-vote",    label: "🗳️ 投票管理" },
              { href: "#sec-review",  label: "📋 討議班審査" },
              { href: "#sec-judge",   label: "⚖️ 審査員" },
              { href: "#sec-winner",  label: "🏆 優勝決定" },
              { href: "#sec-backup",  label: "💾 バックアップ" },
            ].map(({ href, label }) => (
              <a key={href} href={href}
                style={{
                  fontSize: "12px", fontWeight: 600,
                  padding: "4px 10px", borderRadius: "20px",
                  background: "#f3f4f6", color: "#374151",
                  textDecoration: "none", border: "1px solid #e5e7eb",
                  whiteSpace: "nowrap", transition: "background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#e0e7ff"; (e.currentTarget as HTMLAnchorElement).style.color = "#4338ca"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#f3f4f6"; (e.currentTarget as HTMLAnchorElement).style.color = "#374151"; }}
              >
                {label}
              </a>
            ))}
          </nav>

          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Basic Settings */}
            <div id="sec-basic" className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
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
                  <div className="flex gap-2 items-center">
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="flex-1 bg-white border border-gray-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-2.5 text-gray-800 outline-none transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(deadline);
                        d.setMinutes(d.getMinutes() + 1);
                        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                          .toISOString().slice(0, 16);
                        setDeadline(local);
                      }}
                      className="px-3 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-xl transition-colors whitespace-nowrap font-bold"
                    >
                      +1分
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                          .toISOString().slice(0, 16);
                        setDeadline(local);
                      }}
                      className="px-3 py-2.5 bg-gray-500 hover:bg-gray-400 text-white text-sm rounded-xl transition-colors whitespace-nowrap"
                    >
                      現在時刻
                    </button>
                  </div>
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
              {/* 基本設定内 保存ボタン */}
              <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                {saveMsg && (
                  <p className={`text-xs font-medium ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                    {saveMsg}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm px-6 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                >
                  {saving ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />保存中...</>
                  ) : "設定を保存"}
                </button>
              </div>
            </div>

            {/* ── 組管理 ── */}
            <div id="sec-group" className="bg-white border-2 border-orange-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <h2 className="text-base font-bold text-gray-800">🏠 組管理</h2>
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="組名を入力（例：鷺組）"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = newGroupName.trim();
                      if (name && !groups.includes(name)) {
                        const next = [...groups, name];
                        setGroups(next);
                        setNewGroupName("");
                        saveGroups(next);
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newGroupName.trim();
                    if (name && !groups.includes(name)) {
                      const next = [...groups, name];
                      setGroups(next);
                      setNewGroupName("");
                      saveGroups(next);
                    }
                  }}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
                >
                  追加
                </button>
              </div>
              {groups.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {groups.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border bg-orange-50 border-orange-200 text-orange-700">
                      {name}
                      <button
                        type="button"
                        onClick={() => {
                          const next = groups.filter((g) => g !== name);
                          setGroups(next);
                          saveGroups(next);
                        }}
                        className="text-orange-400 hover:text-red-500 ml-0.5 transition-colors"
                      >×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">組が登録されていません</p>
              )}
              <p className="text-gray-400 text-xs mt-3">※ 組の追加・削除は即座に保存されます</p>
            </div>

            {/* Options */}
            <div id="sec-options" className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-gray-700 font-semibold text-sm tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                  発表お題 ({options.length}/8)
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
              <div className="flex items-center justify-between mt-3">
                <p className="text-gray-400 text-xs">選択肢は2〜8個設定できます</p>
                <button
                  id="main-save-btn"
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      保存中...
                    </>
                  ) : "設定を保存"}
                </button>
              </div>
              {saveMsg && (
                <p className={`text-right text-xs font-medium mt-1.5 ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {saveMsg}
                </p>
              )}
            </div>

            {/* Actions */}
            <div id="sec-vote" className="flex flex-col gap-3">

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

              {/* 投票内容確認 */}
              <button
                type="button"
                onClick={() => router.push("/kanri/votes")}
                className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-600 font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>🗳️</span> 投票内容の確認・無効票削除
              </button>

              {/* 社員投票 結果パネル */}
              <div className="bg-white border-2 border-emerald-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-800">📊 社員投票 結果</h2>
                  <button
                    type="button"
                    onClick={fetchVoteResults}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    更新
                  </button>
                </div>
                {voteStats ? (() => {
                  const maxCount = Math.max(...voteStats.results.map((r) => r.count), 1);
                  const optionOrder = config?.options.map((o) => o.id) ?? [];
                  const sorted = [...voteStats.results].sort(
                    (a, b) => optionOrder.indexOf(a.productId) - optionOrder.indexOf(b.productId)
                  );
                  const topCount = Math.max(...sorted.map((r) => r.count), 0);
                  return (
                    <>
                      <p className="text-xs text-gray-500 mb-3">
                        総投票数：<span className="font-black text-emerald-600 text-sm">{voteStats.totalVotes}</span> 票
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {sorted.map((r) => {
                          const pct = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
                          const isFirst = topCount > 0 && r.count === topCount;
                          return (
                            <div key={r.productId}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                  {isFirst && <span className="text-base">🥇</span>}
                                  {r.productNumber.replace("\n", " ")}
                                </span>
                                <span className="text-sm font-black text-gray-800">
                                  {r.count} <span className="text-xs font-normal text-gray-400">票</span>
                                  <span className="text-xs text-gray-400 ml-1.5">({r.percentage}%)</span>
                                </span>
                              </div>
                              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isFirst ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-blue-400 to-indigo-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })() : (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => router.push("/announce")}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    🎬 社員投票 結果発表へ
                  </button>
                </div>
              </div>

            </div>
          </form>

          {/* ────────────── 討議班審査 セクション区切り ────────────── */}
          <div className="mt-10 mb-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase px-2 whitespace-nowrap">討議班審査</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-gray-300 to-transparent" />
          </div>

          {/* ── 討議班審査管理カード ── */}
          <div id="sec-review" className="bg-white border-2 border-teal-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">📋 討議班審査管理</h2>
              <button
                type="button"
                onClick={fetchReviewData}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                更新
              </button>
            </div>

            {/* 討議班リスト管理 */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2">審査対象（討議班）</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder="班名を入力（例：1班、Aチーム）"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-teal-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = newTargetName.trim();
                      if (name && !reviewTargets.some((t) => t.name === name)) {
                        const next = [...reviewTargets, { id: uuidv4(), name }];
                        setReviewTargets(next);
                        setNewTargetName("");
                        saveReviewTargets(next);
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newTargetName.trim();
                    if (name && !reviewTargets.some((t) => t.name === name)) {
                      const next = [...reviewTargets, { id: uuidv4(), name }];
                      setReviewTargets(next);
                      setNewTargetName("");
                      saveReviewTargets(next);
                    }
                  }}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors"
                >
                  追加
                </button>
              </div>
              {reviewTargets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {reviewTargets.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border bg-teal-50 border-teal-200 text-teal-700">
                      {t.name}
                      <button
                        type="button"
                        onClick={() => {
                          const next = reviewTargets.filter((x) => x.id !== t.id);
                          setReviewTargets(next);
                          saveReviewTargets(next);
                        }}
                        className="text-teal-400 hover:text-red-500 transition-colors"
                      >×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">討議班が未登録です</p>
              )}
              <p className="text-xs text-gray-400 mt-2">※ 追加・削除は即座に保存されます</p>
            </div>

            {/* 審査項目名編集 */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2">審査項目名</p>
              <div className="flex flex-col gap-2">
                {([0, 1, 2] as const).map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-10 shrink-0">項目{i + 1}</span>
                    <input
                      type="text"
                      value={criteriaLabels[i]}
                      onChange={(e) => {
                        const next: [string, string, string] = [...criteriaLabels] as [string, string, string];
                        next[i] = e.target.value;
                        setCriteriaLabels(next);
                      }}
                      onBlur={() => saveCriteriaLabels(criteriaLabels)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-teal-400"
                      placeholder={`項目${i + 1}の名前`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">※ 入力欄を離れると自動保存されます</p>
            </div>

            <div className="border-t border-gray-100 pt-5">
              {/* 入力進捗 */}
              {reviewData && reviewData.judges.length > 0 && reviewTargets.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">入力進捗</p>
                  <div className="flex flex-col gap-1.5">
                    {reviewData.judges.map((judge) => {
                      const done = (reviewData.judgeProgress[judge] ?? []).length;
                      const total = reviewTargets.length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div key={judge} className="flex items-center gap-3">
                          <span className="text-sm text-gray-700 w-24 truncate">{judge}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{done}/{total}</span>
                          {done > 0 && (
                            <button
                              type="button"
                              onClick={() => setReviewResetConfirm(judge)}
                              className="text-xs text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              取消
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 集計結果 */}
              {reviewData && reviewData.results.some((r) => r.reviewCount > 0) && (() => {
                // 班ごとに項目別合計を計算
                const withCriteria = reviewData.results.map((r) => ({
                  ...r,
                  c1: r.scores.reduce((s, x) => s + x.criterion1, 0),
                  c2: r.scores.reduce((s, x) => s + x.criterion2, 0),
                  c3: r.scores.reduce((s, x) => s + x.criterion3, 0),
                }));

                // 項目ごとに降順ソート（同点は合計で決める）
                const criteriaKeys = ["c1", "c2", "c3"] as const;

                return (
                  <div className="mb-4 flex flex-col gap-4">
                    <p className="text-xs font-semibold text-gray-500">採点集計（項目別ランキング）</p>
                    {criteriaKeys.map((key, ki) => {
                      const label = reviewData.criteriaLabels?.[ki] || `項目${ki + 1}`;
                      const sorted = [...withCriteria].sort((a, b) =>
                        b[key] !== a[key] ? b[key] - a[key] : b.totalScore - a.totalScore
                      );
                      const maxVal = sorted[0]?.[key] ?? 0;
                      return (
                        <div key={key}>
                          <p className="text-xs font-bold mb-1.5 text-gray-600">
                            <span className="text-gray-400 mr-1">項目{ki + 1}</span>{label}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {sorted.map((r, idx) => {
                              const val = r[key];
                              const n = r.reviewCount;
                              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                              const isTop = idx === 0;
                              return (
                                <div key={r.productId} className={`rounded-xl border px-3 py-2 ${isTop ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-black w-4 text-center ${isTop ? "text-orange-500" : "text-gray-400"}`}>{idx + 1}</span>
                                      <span className="text-sm font-bold text-gray-800">{r.productNumber}</span>
                                      {n > 0 && <span className="text-xs text-gray-400">合計 {r.totalScore}pt</span>}
                                    </div>
                                    <div className="flex items-baseline gap-0.5">
                                      <span className={`text-lg font-black ${isTop ? "text-orange-600" : "text-gray-700"}`}>{val}</span>
                                      <span className="text-xs text-gray-400">/{n * 5}</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${isTop ? "bg-orange-400" : "bg-blue-900"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {(!reviewData || reviewData.results.every((r) => r.reviewCount === 0)) && reviewTargets.length > 0 && (
                <p className="text-sm text-gray-400 mb-4">まだ採点データがありません</p>
              )}

              {/* 全データリセット確認 */}
              {reviewResetConfirm && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                  <p className="text-rose-600 text-sm text-center mb-3 font-medium">
                    {reviewResetConfirm === "all"
                      ? "⚠️ 討議班審査の全採点データを削除します"
                      : `⚠️「${reviewResetConfirm}」の採点データを削除します`}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setReviewResetConfirm(null)} className="flex-1 bg-white border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
                    <button type="button" onClick={() => handleReviewReset(reviewResetConfirm)} disabled={reviewResetting} className="flex-1 bg-rose-500 border border-rose-500 text-white py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
                      {reviewResetting ? "削除中..." : "削除する"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-start">
                <button type="button" onClick={() => setReviewResetConfirm("all")} className="text-xs text-rose-400 hover:text-rose-600 border border-rose-200 hover:border-rose-300 px-3 py-1.5 rounded-lg transition-colors">
                  採点データを全削除
                </button>
              </div>
            </div>
          </div>

          {/* 討議班審査ページ・表彰発表ページへのリンク */}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/review")}
              className="text-sm bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
            >
              📋 討議班審査ページへ →
            </button>
            <button
              type="button"
              onClick={() => router.push("/review/announce")}
              className="text-sm bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              🏆 討議班3賞発表 →
            </button>
          </div>

          {/* ────────────── セクション区切り ────────────── */}
          <div className="mt-10 mb-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase px-2 whitespace-nowrap">審査員・優勝決定</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-gray-300 to-transparent" />
          </div>

          {/* ── 審査員管理 ── */}
          <div id="sec-judge" className="bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center mb-4">
              <h2 className="text-base font-bold text-gray-800">⚖️ 審査員管理</h2>
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
                      <button
                        type="button"
                        onClick={() => {
                          if (voted && !confirm(`「${name}」は投票済みです。削除してもよいですか？`)) return;
                          const next = judges.filter((j) => j !== name);
                          setJudges(next);
                          saveJudges(next);
                        }}
                        className={`ml-0.5 transition-colors ${voted ? "text-emerald-400 hover:text-red-500" : "text-gray-400 hover:text-red-500"}`}
                      >×</button>
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

          {/* 審査員投票ページへのリンク */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/judge")}
              className="text-sm bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 font-medium px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
            >
              ⚖️ 審査員投票ページへ →
            </button>
          </div>

          {/* ── 優勝決定画面 ── */}
          <div id="sec-winner" className="mt-8 bg-white border-2 border-amber-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800">🏆 優勝決定</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { fetchJudgeData(); setShowWinner(true); }}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-md"
                >
                  結果確認
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/judge/announce")}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-md"
                >
                  🎤 審査発表へ
                </button>
              </div>
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


          {/* ── バックアップ・リストア ── */}
          <div id="sec-backup" className="mt-8 bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-4">💾 バックアップ・リストア</h2>

            <div className="flex flex-col gap-4">
              {/* バックアップ */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">データをバックアップ</p>
                  <p className="text-xs text-gray-400 mt-0.5">設定・投票データ全てをJSONファイルでダウンロード</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setBackupMsg("ダウンロード中...");
                      const res = await fetch("/api/admin/backup");
                      if (!res.ok) throw new Error("失敗");
                      const blob = await res.blob();
                      const cd = res.headers.get("Content-Disposition") ?? "";
                      const match = cd.match(/filename="([^"]+)"/);
                      const filename = match?.[1] ?? "backup.json";
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = filename; a.click();
                      URL.revokeObjectURL(url);
                      setBackupMsg("✅ ダウンロード完了");
                    } catch {
                      setBackupMsg("❌ 失敗しました");
                    }
                    setTimeout(() => setBackupMsg(""), 3000);
                  }}
                  className="shrink-0 ml-4 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                >
                  📥 ダウンロード
                </button>
              </div>
              {backupMsg && <p className="text-xs text-center text-gray-500">{backupMsg}</p>}

              {/* リストア */}
              <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-rose-700">データをリストア</p>
                <p className="text-xs text-rose-400 mt-0.5 mb-3">バックアップJSONを選択すると全データが上書き復元されます</p>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".json,application/json"
                    id="restore-file-input"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!window.confirm(`「${file.name}」でデータを上書き復元します。現在のデータは失われます。よろしいですか？`)) {
                        e.target.value = "";
                        return;
                      }
                      setRestoring(true);
                      setRestoreMsg("");
                      try {
                        const text = await file.text();
                        const json = JSON.parse(text);
                        const res = await fetch("/api/admin/backup", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(json),
                        });
                        const result = await res.json() as { ok?: boolean; error?: string; restored?: Record<string, number> };
                        if (result.ok) {
                          const r = result.restored ?? {};
                          setRestoreMsg(`✅ 復元完了：設定${r.config}件・投票${r.votes}件・審査${r.judgeVotes}件・討議${r.reviewScores}件`);
                          fetchConfig();
                        } else {
                          setRestoreMsg(`❌ エラー：${result.error}`);
                        }
                      } catch {
                        setRestoreMsg("❌ ファイルの読み込みに失敗しました");
                      } finally {
                        setRestoring(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  <label
                    htmlFor="restore-file-input"
                    className={`cursor-pointer shrink-0 border border-rose-300 text-rose-600 hover:bg-rose-100 text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${restoring ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {restoring ? "⏳ 復元中..." : "📤 ファイルを選択"}
                  </label>
                  {restoreMsg && <p className="text-xs text-gray-600">{restoreMsg}</p>}
                </div>
              </div>
            </div>
          </div>

          </>
        )}
      </div>
    </main>
  );
}
