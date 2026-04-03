"use client";

import React, { useEffect, useRef, useState } from "react";

interface SoundItem {
  id: string;
  label: string;
  src: string;
  emoji: string;
  loop?: boolean;
}

const SOUNDS: SoundItem[] = [
  { id: "chime",          label: "チャイム",            src: "/sp-chime.wav",                  emoji: "🔔" },
  { id: "start-buzzer",   label: "開始ブザー",          src: "/sp-start-buzzer.wav",           emoji: "🚨" },
  { id: "drum-roll",      label: "ドラムロール",        src: "/sp-drum-roll.wav",              emoji: "🥁" },
  { id: "correct",        label: "正解音",              src: "/sp-correct.wav",                emoji: "⭕" },
  { id: "wrong",          label: "不正解",              src: "/sp-wrong.wav",                  emoji: "❌" },
  { id: "mario",          label: "マリオ考え中",        src: "/sp-mario-thinking.mp3",         emoji: "🍄" },
  { id: "among",          label: "Among Terraced Houses", src: "/sp-among-terraced-houses.mp3", emoji: "🎵", loop: true },
  { id: "fight",          label: "Fight Song",          src: "/sp-fight-song.mp3",             emoji: "🎤", loop: true },
  { id: "champions",      label: "We Are The Champions",src: "/sp-we-are-the-champions.mp3",   emoji: "🏆", loop: true },
  { id: "undokai",        label: "舵取り楫取",           src: "/sp-undokai.mp4",                emoji: "🎪", loop: true },
];

const FADE_DURATION = 3000; // ms
const FADE_STEP     = 50;   // ms ごとに更新

export default function SoundPalette() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<Set<string>>(new Set());
  const [fading, setFading] = useState(false);
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const audioRefs   = useRef<Map<string, HTMLAudioElement>>(new Map());
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // スライドモーダルが開いているときは非表示
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setSlideModalOpen(document.body.classList.contains("slide-modal-open"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // マウント時に全音源をプリロード
  useEffect(() => {
    for (const s of SOUNDS) {
      const audio = new Audio(s.src);
      audio.preload = "auto";
      audio.loop = s.loop ?? false;
      audio.addEventListener("ended", () => {
        setPlaying((prev) => { const next = new Set(prev); next.delete(s.id); return next; });
      });
      audioRefs.current.set(s.id, audio);
    }
    return () => {
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
      audioRefs.current.forEach((a) => { a.pause(); a.src = ""; });
    };
  }, []);

  const handlePlay = (id: string) => {
    // フェード中は個別操作を無視しない（フェードをキャンセルしてから操作）
    if (fading) cancelFade();
    const audio = audioRefs.current.get(id);
    if (!audio) return;
    if (playing.has(id)) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      audio.volume = 1;
      audio.currentTime = 0;
      audio.play();
      setPlaying((prev) => new Set(prev).add(id));
    }
  };

  const stopAll = () => {
    cancelFade();
    audioRefs.current.forEach((a) => { a.pause(); a.currentTime = 0; a.volume = 1; });
    setPlaying(new Set());
  };

  const cancelFade = () => {
    if (fadeTimerRef.current) { clearInterval(fadeTimerRef.current); fadeTimerRef.current = null; }
    // ボリュームを元に戻す
    audioRefs.current.forEach((a) => { a.volume = 1; });
    setFading(false);
  };

  const fadeOut = () => {
    if (fading) { cancelFade(); return; }   // 再度押したらキャンセル
    if (playing.size === 0) return;

    setFading(true);
    const steps = FADE_DURATION / FADE_STEP;
    let step = 0;

    fadeTimerRef.current = setInterval(() => {
      step++;
      const vol = Math.max(0, 1 - step / steps);
      audioRefs.current.forEach((a) => { if (!a.paused) a.volume = vol; });

      if (step >= steps) {
        clearInterval(fadeTimerRef.current!);
        fadeTimerRef.current = null;
        audioRefs.current.forEach((a) => { a.pause(); a.currentTime = 0; a.volume = 1; });
        setPlaying(new Set());
        setFading(false);
      }
    }, FADE_STEP);
  };

  if (slideModalOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
      }}
    >
      {/* パネル本体 */}
      <div
        style={{
          width: open ? "220px" : "0px",
          overflow: "hidden",
          transition: "width 0.25s ease",
          background: "rgba(15,17,24,0.97)",
          border: open ? "1px solid rgba(160,170,190,0.2)" : "none",
          borderRight: "none",
          borderRadius: "12px 0 0 12px",
          boxShadow: open ? "-4px 0 24px rgba(0,0,0,0.4)" : "none",
        }}
      >
        <div style={{ width: "220px", padding: "12px 10px" }}>
          {/* ヘッダー */}
          <div style={{ marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid rgba(160,170,190,0.15)" }}>
            <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em" }}>🎵 SOUND PAD</span>
            {playing.size > 0 && (
              <div style={{ display: "flex", gap: "5px", marginTop: "7px" }}>
                {/* フェードアウト */}
                <button
                  onClick={fadeOut}
                  style={{
                    flex: 1,
                    fontSize: "10px",
                    color: fading ? "#fbbf24" : "#a78bfa",
                    background: fading ? "rgba(251,191,36,0.12)" : "rgba(139,92,246,0.12)",
                    border: fading ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(139,92,246,0.35)",
                    borderRadius: "6px",
                    padding: "3px 6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {fading ? "↩ キャンセル" : "〜 FadeOut"}
                </button>
                {/* 全停止 */}
                <button
                  onClick={stopAll}
                  style={{
                    flex: 1,
                    fontSize: "10px",
                    color: "#f87171",
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "6px",
                    padding: "3px 6px",
                    cursor: "pointer",
                  }}
                >
                  ■ 全停止
                </button>
              </div>
            )}
          </div>

          {/* サウンドボタン一覧 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {SOUNDS.map((s) => {
              const isPlaying = playing.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => handlePlay(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 10px",
                    borderRadius: "8px",
                    border: isPlaying
                      ? "1px solid rgba(99,202,183,0.6)"
                      : "1px solid rgba(160,170,190,0.15)",
                    background: isPlaying
                      ? "rgba(99,202,183,0.12)"
                      : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    if (!isPlaying) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.border = "1px solid rgba(160,170,190,0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPlaying) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.border = "1px solid rgba(160,170,190,0.15)";
                    }
                  }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>{s.emoji}</span>
                  <span style={{ fontSize: "11px", color: isPlaying ? "#6bcab7" : "#94a3b8", fontWeight: isPlaying ? 700 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.label}
                  </span>
                  {isPlaying && (
                    <span style={{ fontSize: "9px", color: fading ? "#fbbf24" : "#6bcab7", flexShrink: 0 }}>
                      {fading ? "〜" : "▶"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* トグルタブ */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          writingMode: "vertical-rl",
          padding: "14px 8px",
          background: open ? "rgba(15,17,24,0.97)" : "rgba(30,34,46,0.92)",
          border: "1px solid rgba(160,170,190,0.2)",
          borderLeft: open ? "1px solid rgba(15,17,24,0.97)" : "1px solid rgba(160,170,190,0.2)",
          borderRadius: open ? "0" : "8px 0 0 8px",
          color: "#94a3b8",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          cursor: "pointer",
          boxShadow: "-2px 0 12px rgba(0,0,0,0.3)",
          transition: "all 0.2s",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
        title={open ? "サウンドパッドを閉じる" : "サウンドパッドを開く"}
      >
        <span style={{ writingMode: "horizontal-tb", fontSize: "14px" }}>
          {playing.size > 0 ? "🔊" : "🎵"}
        </span>
        <span>サウンド</span>
        {playing.size > 0 && (
          <span style={{ writingMode: "horizontal-tb", fontSize: "9px", background: "rgba(99,202,183,0.2)", color: "#6bcab7", borderRadius: "4px", padding: "1px 4px" }}>
            {playing.size}
          </span>
        )}
      </button>
    </div>
  );
}
