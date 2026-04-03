"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface SlideListItem {
  id: string;
  name: string;
  type: "image" | "link";
  url?: string;
  order: number;
}

// 投票画面（/）は表示しない
const HIDDEN_PATHS = ["/"];

export default function SlidePanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<SlideListItem[]>([]);
  const [modalImgSrc, setModalImgSrc] = useState<string | null>(null);
  const [modalName, setModalName] = useState("");
  const [loadingImg, setLoadingImg] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchSlides = useCallback(async () => {
    try {
      const res = await fetch("/api/slides");
      if (!res.ok) return;
      const json = await res.json();
      setSlides((json.slides ?? []).sort((a: SlideListItem, b: SlideListItem) => a.order - b.order));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchSlides();
  }, [fetchSlides]);

  // パネル外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 投票画面では非表示
  if (HIDDEN_PATHS.includes(pathname)) return null;
  // スライドが0件のときも非表示（管理者のみ気にする）
  if (slides.length === 0) return null;

  const handleItemClick = async (item: SlideListItem) => {
    if (item.type === "link") {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    // 画像モーダル
    setOpen(false);   // パネルを畳む
    setLoadingImg(true);
    setModalName(item.name);
    setModalImgSrc(`/api/slides/${item.id}`);
    setLoadingImg(false);
  };

  return (
    <>
      {/* ── フローティングボタン ── */}
      <div ref={panelRef} style={{
        position: "fixed", bottom: "20px", left: "20px", zIndex: 2100,
        display: "flex", flexDirection: "column", alignItems: "flex-start",
      }}>
        {/* パネル */}
        {open && (
          <div style={{
            marginBottom: "8px",
            background: "linear-gradient(155deg, #2a2f42 0%, #1e2232 50%, #141720 100%)",
            border: "1px solid rgba(200,215,240,0.18)",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(160,180,230,0.08)",
            overflow: "hidden",
            minWidth: "220px",
            maxWidth: "300px",
            maxHeight: "70vh",
            overflowY: "auto",
            animation: "slidePanelIn 0.2s ease-out",
          }}>
            {/* ヘッダ */}
            <div style={{
              padding: "10px 14px 8px",
              borderBottom: "1px solid rgba(200,215,240,0.10)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(200,215,240,0.7)", letterSpacing: "0.1em" }}>
                📋 スライド / リンク
              </span>
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", color: "rgba(200,215,240,0.4)",
                cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "0 2px",
              }}>✕</button>
            </div>
            {/* アイテム一覧 */}
            <div style={{ padding: "6px 0" }}>
              {slides.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    width: "100%", padding: "9px 14px",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#dce4f4", fontSize: "13px", fontWeight: 600,
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(96,165,250,0.10)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>
                    {item.type === "image" ? "🖼️" : "🔗"}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* メインボタン */}
        <button
          onClick={() => { setOpen((v) => !v); if (!open) fetchSlides(); }}
          title="スライド / リンク"
          style={{
            width: "44px", height: "44px",
            borderRadius: "12px",
            background: open
              ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
              : "linear-gradient(135deg, #1e2232, #141720)",
            border: `1px solid ${open ? "rgba(96,165,250,0.6)" : "rgba(200,215,240,0.20)"}`,
            boxShadow: open
              ? "0 0 16px rgba(96,165,250,0.4), 0 4px 12px rgba(0,0,0,0.6)"
              : "0 4px 12px rgba(0,0,0,0.5)",
            color: open ? "#fff" : "rgba(200,215,240,0.55)",
            fontSize: "20px",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          📋
        </button>
      </div>

      {/* ── 画像モーダル ── */}
      {(modalImgSrc || loadingImg) && (
        <div
          onClick={() => { setModalImgSrc(null); setModalName(""); }}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "#000",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {/* 閉じるボタン（右上） */}
          <button
            onClick={() => { setModalImgSrc(null); setModalName(""); }}
            style={{
              position: "absolute", top: "16px", right: "16px", zIndex: 1,
              background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px", color: "#fff", padding: "8px 16px",
              cursor: "pointer", fontSize: "14px", fontWeight: 600,
            }}
          >
            ✕ 閉じる
          </button>
          {/* 名前（左上） */}
          {modalName && (
            <div style={{ position: "absolute", top: "16px", left: "16px", zIndex: 1 }}>
              <span style={{ color: "rgba(220,228,244,0.80)", fontSize: "14px", fontWeight: 600, background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: "6px" }}>
                {modalName}
              </span>
            </div>
          )}
          {loadingImg ? (
            <div style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.15)", borderTop: "3px solid #60a5fa", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={modalImgSrc!}
              alt={modalName}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100vw", height: "100vh",
                objectFit: "contain",
                cursor: "default",
              }}
            />
          )}
        </div>
      )}

      <style>{`
        @keyframes slidePanelIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
