"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SlideItem {
  id: string;
  name: string;
  type: "image" | "link";
  url?: string;
  order: number;
}

const M = {
  bg:          "#0b0d12",
  panelBg:     "linear-gradient(155deg, #2a2f42 0%, #1e2232 50%, #141720 100%)",
  cardBg:      "linear-gradient(160deg, #252a3a 0%, #1a1d28 45%, #13151e 100%)",
  cardBorder:  "rgba(200,215,240,0.16)",
  silver:      "#dce4f4",
  silverDim:   "rgba(200,215,240,0.60)",
  silverFaint: "rgba(175,190,220,0.35)",
  accent:      "#60a5fa",
  green:       "#34d399",
  red:         "#f87171",
  topLine:     "linear-gradient(90deg, transparent 0%, rgba(160,180,230,0.6) 30%, rgba(200,220,255,0.9) 50%, rgba(160,180,230,0.6) 70%, transparent 100%)",
};

export default function SlidesManagePage() {
  const router = useRouter();
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"image" | "link">("image");
  const [formUrl, setFormUrl] = useState("");
  const [formImageB64, setFormImageB64] = useState("");
  const [formImagePreview, setFormImagePreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const showMsg = (text: string, type: "ok" | "err") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const fetchSlides = useCallback(async () => {
    const res = await fetch("/api/slides");
    if (!res.ok) return;
    const json = await res.json();
    setSlides((json.slides ?? []).sort((a: SlideItem, b: SlideItem) => a.order - b.order));
  }, []);

  useEffect(() => { fetchSlides(); }, [fetchSlides]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setFormImageB64(result);
      setFormImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setEditId(null); setFormName(""); setFormType("image");
    setFormUrl(""); setFormImageB64(""); setFormImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) { showMsg("呼出名を入力してください", "err"); return; }
    if (formType === "link" && !formUrl.trim()) { showMsg("URLを入力してください", "err"); return; }
    if (formType === "image" && !formImageB64 && !editId) { showMsg("画像を選択してください", "err"); return; }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(), type: formType,
        data: formType === "link" ? formUrl.trim() : (formImageB64 || undefined),
      };
      if (formType === "image" && !formImageB64 && editId) delete body.data;
      const url = editId ? `/api/slides/${editId}` : "/api/slides";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { showMsg(json.error ?? "失敗しました", "err"); return; }
      showMsg(editId ? "更新しました" : "追加しました", "ok");
      resetForm(); fetchSlides();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const res = await fetch(`/api/slides/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const json = await res.json();
    if (!res.ok) { showMsg(json.error ?? "削除失敗", "err"); return; }
    showMsg("削除しました", "ok"); fetchSlides();
  };

  const handleMove = async (item: SlideItem, dir: "up" | "down") => {
    const idx = slides.findIndex((s) => s.id === item.id);
    const target = dir === "up" ? slides[idx - 1] : slides[idx + 1];
    if (!target) return;
    await Promise.all([
      fetch(`/api/slides/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: target.order }) }),
      fetch(`/api/slides/${target.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: item.order }) }),
    ]);
    fetchSlides();
  };

  return (
    <main style={{ minHeight: "100vh", background: M.bg, padding: "24px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* ヘッダ */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button onClick={() => router.push("/kanri")} style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${M.cardBorder}`, background: "rgba(255,255,255,0.04)", color: M.silverDim, cursor: "pointer", fontSize: "12px" }}>
            ← 管理画面
          </button>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: M.silver, flex: 1 }}>📋 スライド / リンク管理</h1>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "8px 18px", borderRadius: "8px", background: "rgba(96,165,250,0.15)", border: `1px solid ${M.accent}`, color: M.accent, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
            ＋ 追加
          </button>
        </div>

        {msg && (
          <div style={{ padding: "10px 16px", borderRadius: "10px", marginBottom: "16px", background: msg.type === "ok" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", border: `1px solid ${msg.type === "ok" ? M.green : M.red}`, color: msg.type === "ok" ? M.green : M.red, fontSize: "13px" }}>
            {msg.text}
          </div>
        )}

        {/* フォーム */}
        {showForm && (
          <div style={{ background: M.panelBg, border: `1px solid ${M.cardBorder}`, borderRadius: "16px", padding: "22px 20px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: M.topLine }} />
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: M.silver, marginBottom: "18px" }}>{editId ? "✏️ 編集" : "＋ 新規追加"}</h2>

            <label style={{ fontSize: "12px", color: M.silverFaint, display: "block", marginBottom: "4px" }}>呼出名 *</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="例：会社概要スライド"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${M.cardBorder}`, background: "rgba(20,23,32,0.9)", color: M.silver, fontSize: "14px", boxSizing: "border-box" as const, marginBottom: "14px" }}
            />

            <label style={{ fontSize: "12px", color: M.silverFaint, display: "block", marginBottom: "6px" }}>種類</label>
            <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
              {(["image", "link"] as const).map((t) => (
                <button key={t} onClick={() => setFormType(t)} style={{
                  padding: "7px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  background: formType === t ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${formType === t ? M.accent : M.cardBorder}`,
                  color: formType === t ? M.accent : M.silverDim,
                }}>
                  {t === "image" ? "🖼️ 画像" : "🔗 URLリンク"}
                </button>
              ))}
            </div>

            {formType === "image" && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: M.silverFaint, display: "block", marginBottom: "6px" }}>
                  画像ファイル {editId ? "（変更する場合のみ）" : "*"}
                </label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ color: M.silverDim, fontSize: "13px" }} />
                {formImagePreview && (
                  <div style={{ marginTop: "10px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formImagePreview} alt="プレビュー" style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain", borderRadius: "8px", border: `1px solid ${M.cardBorder}` }} />
                  </div>
                )}
              </div>
            )}

            {formType === "link" && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: M.silverFaint, display: "block", marginBottom: "4px" }}>URL *</label>
                <input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://example.com"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${M.cardBorder}`, background: "rgba(20,23,32,0.9)", color: M.silver, fontSize: "14px", boxSizing: "border-box" as const }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleSave} disabled={loading} style={{ padding: "9px 22px", borderRadius: "8px", background: "rgba(96,165,250,0.15)", border: `1px solid ${M.accent}`, color: M.accent, fontWeight: 700, cursor: "pointer", fontSize: "14px", opacity: loading ? 0.6 : 1 }}>
                {loading ? "保存中..." : "💾 保存"}
              </button>
              <button onClick={resetForm} style={{ padding: "9px 16px", borderRadius: "8px", background: "none", border: `1px solid ${M.cardBorder}`, color: M.silverDim, cursor: "pointer", fontSize: "13px" }}>
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* リスト */}
        {slides.length === 0 ? (
          <div style={{ background: M.panelBg, border: `1px solid ${M.cardBorder}`, borderRadius: "14px", padding: "32px", textAlign: "center", color: M.silverFaint, fontSize: "14px" }}>
            登録されたスライド・リンクはありません
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {slides.map((item, idx) => (
              <div key={item.id} style={{ background: M.cardBg, border: `1px solid ${M.cardBorder}`, borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(200,215,255,0.10), transparent)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <button onClick={() => handleMove(item, "up")} disabled={idx === 0} style={{ background: "none", border: "none", color: idx === 0 ? M.silverFaint : M.silverDim, cursor: idx === 0 ? "default" : "pointer", fontSize: "12px", padding: "2px 4px" }}>▲</button>
                  <button onClick={() => handleMove(item, "down")} disabled={idx === slides.length - 1} style={{ background: "none", border: "none", color: idx === slides.length - 1 ? M.silverFaint : M.silverDim, cursor: idx === slides.length - 1 ? "default" : "pointer", fontSize: "12px", padding: "2px 4px" }}>▼</button>
                </div>
                <span style={{ fontSize: "20px", flexShrink: 0 }}>{item.type === "image" ? "🖼️" : "🔗"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: M.silver, margin: 0 }}>{item.name}</p>
                  {item.type === "link" && <p style={{ fontSize: "11px", color: M.silverFaint, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.url}</p>}
                  {item.type === "image" && <p style={{ fontSize: "11px", color: M.silverFaint, margin: "2px 0 0" }}>画像スライド</p>}
                </div>
                <button onClick={() => { setEditId(item.id); setFormName(item.name); setFormType(item.type); setFormUrl(item.url ?? ""); setFormImageB64(""); setFormImagePreview(item.type === "image" ? `/api/slides/${item.id}` : ""); setShowForm(true); }}
                  style={{ padding: "6px 12px", borderRadius: "7px", background: "rgba(96,165,250,0.08)", border: `1px solid rgba(96,165,250,0.25)`, color: M.accent, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                  編集
                </button>
                <button onClick={() => handleDelete(item.id, item.name)}
                  style={{ padding: "6px 12px", borderRadius: "7px", background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.25)`, color: M.red, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
