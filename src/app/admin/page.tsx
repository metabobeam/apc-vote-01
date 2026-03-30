"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductOption } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface Config {
  title: string;
  deadline: string;
  options: ProductOption[];
  isActive: boolean;
  maxSelections: number;
}

type AdminStep = "login" | "dashboard";

export default function AdminPage() {
  const router = useRouter();
  const [step, setStep] = useState<AdminStep>("login");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [config, setConfig] = useState<Config | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxSelections, setMaxSelections] = useState(1);
  const [options, setOptions] = useState<ProductOption[]>([]);

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
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate password via a test PUT request
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setLoginError("");
      setStep("dashboard");
      fetchConfig();
    } else {
      setLoginError("パスワードが正しくありません");
    }
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
      <main className="min-h-screen grid-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-start px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-cyan-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-full px-3 py-1 mb-2">
              <span className="text-violet-400 text-xs font-semibold tracking-widest">ADMIN PANEL</span>
            </div>
            <h1 className="text-2xl font-bold gradient-text">管理者ダッシュボード</h1>
          </div>
          {step === "dashboard" && (
            <button
              onClick={() => router.push("/")}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← 投票ページ
            </button>
          )}
        </div>

        {/* Login */}
        {step === "login" && (
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔐</div>
              <h2 className="text-xl font-bold text-slate-200">管理者認証</h2>
              <p className="text-slate-500 text-sm mt-1">管理者パスワードを入力してください</p>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                className="w-full bg-slate-800/80 border border-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all"
              />
              {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
              >
                ログイン
              </button>
            </form>
            <button
              onClick={() => router.push("/")}
              className="w-full mt-3 text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              ← 投票ページへ戻る
            </button>
          </div>
        )}

        {/* Dashboard */}
        {step === "dashboard" && config && (
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Basic Settings */}
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <h2 className="text-slate-200 font-semibold text-sm tracking-wide mb-5 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-400 rounded-full" />
                基本設定
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 tracking-wide">投票タイトル</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-600 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 tracking-wide">締め切り日時</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-600 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white outline-none transition-all text-sm [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-2 tracking-wide">投票択数</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxSelections(n)}
                        className={`
                          flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all
                          ${maxSelections === n
                            ? "border-cyan-500 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                            : "border-slate-700 bg-slate-800/60 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                          }
                        `}
                      >
                        {n}択
                      </button>
                    ))}
                  </div>
                  <p className="text-slate-600 text-xs mt-1.5">
                    {maxSelections === 1 ? "1作品のみ選択" : `上位${maxSelections}作品を選択`}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">投票受付</span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`
                      relative w-12 h-6 rounded-full transition-all duration-300
                      ${isActive ? "bg-indigo-600" : "bg-slate-700"}
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
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-slate-200 font-semibold text-sm tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                  投票選択肢 ({options.length}/8)
                </h2>
                <button
                  type="button"
                  onClick={addOption}
                  disabled={options.length >= 8}
                  className="text-xs bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + 追加
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 flex-shrink-0 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center text-xs font-bold text-slate-400">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <input
                      type="text"
                      value={option.productNumber}
                      onChange={(e) => updateOption(option.id, "productNumber", e.target.value)}
                      placeholder={`商品番号 ${index + 1}`}
                      className="flex-1 bg-slate-800/80 border border-slate-600 focus:border-indigo-500 rounded-xl px-3 py-2 text-white placeholder-slate-600 outline-none transition-all text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(option.id)}
                      disabled={options.length <= 2}
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-slate-500 hover:text-red-400 bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-slate-600 text-xs mt-3">選択肢は2〜8個設定できます</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {saveMsg && (
                <p className={`text-center text-sm font-medium ${saveMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                  {saveMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    保存中...
                  </>
                ) : "設定を保存"}
              </button>

              <div className="border-t border-slate-800 pt-3">
                {!resetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setResetConfirm(true)}
                    className="w-full bg-slate-800 hover:bg-red-950/50 border border-slate-700 hover:border-red-900 text-slate-400 hover:text-red-400 font-medium py-3 rounded-xl transition-all text-sm"
                  >
                    投票データをリセット
                  </button>
                ) : (
                  <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
                    <p className="text-red-400 text-sm text-center mb-3 font-medium">
                      ⚠️ 全投票データを削除します。この操作は取り消せません。
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResetConfirm(false)}
                        className="flex-1 bg-slate-800 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={resetting}
                        className="flex-1 bg-red-900/50 border border-red-700 text-red-300 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
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
                  className="flex-1 text-slate-500 hover:text-slate-300 text-sm transition-colors py-2"
                >
                  結果ページ →
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/announce")}
                  className="flex-1 bg-gradient-to-r from-violet-700/40 to-indigo-700/40 hover:from-violet-700/60 hover:to-indigo-700/60 border border-violet-500/40 text-violet-300 font-bold text-sm py-2.5 rounded-xl transition-all"
                >
                  🎬 結果発表へ
                </button>
              </div>
              <button
                type="button"
                onClick={() => router.push("/admin/votes")}
                className="w-full bg-rose-900/20 hover:bg-rose-900/40 border border-rose-800/50 hover:border-rose-700/60 text-rose-300 font-medium text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>🗳️</span> 投票内容の確認・無効票削除
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
