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

  const openModal = (src: string, name: string) => {
    setModalImgSrc(src);
    setModalName(name);
    document.body.classList.add("slide-modal-open");
  };

  const closeModal = () => {
    setModalImgSrc(null);
    setModalName("");
    document.body.classList.remove("slide-modal-open");
  };

  const handleItemClick = async (item: SlideListItem) => {
    if (item.type === "link") {
      window.location.href = item.url!;
      return;
    }
    setOpen(false);
    setLoadingImg(true);
    openModal(`/api/slides/${item.id}`, item.name);
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
            background: "transparent",
            overflow: "hidden",
            minWidth: "220px",
            maxWidth: "300px",
            maxHeight: "70vh",
            overflowY: "auto",
            animation: "slidePanelIn 0.2s ease-out",
          }}>
            {/* アイテム一覧 */}
            <div style={{ padding: "4px 0", display: "flex", flexDirection: "column", gap: "4px" }}>
              {slides.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    width: "100%", padding: "9px 14px",
                    background: "rgba(14,17,26,0.25)",
                    border: "1px solid rgba(200,215,240,0.12)",
                    borderRadius: "10px",
                    cursor: "pointer",
                    color: "#dce4f4", fontSize: "13px", fontWeight: 600,
                    textAlign: "left",
                    backdropFilter: "blur(10px)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(96,165,250,0.25)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(14,17,26,0.25)")}
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
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "#000",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
            animation: "fadeIn 0.2s ease",
          }}
        >
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
