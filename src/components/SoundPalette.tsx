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
  { id: "undokai",        label: "GKH 運動会用",        src: "/sp-undokai.mp4",                emoji: "🎪", loop: true },
];

export default function SoundPalette() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<Set<string>>(new Set());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

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
      audioRefs.current.forEach((a) => { a.pause(); a.src = ""; });
    };
  }, []);

  const handlePlay = (id: string) => {
    const audio = audioRefs.current.get(id);
    if (!audio) return;
    if (playing.has(id)) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      audio.currentTime = 0;
      audio.play();
      setPlaying((prev) => new Set(prev).add(id));
    }
  };

  const stopAll = () => {
    audioRefs.current.forEach((a) => { a.pause(); a.currentTime = 0; });
    setPlaying(new Set());
  };

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid rgba(160,170,190,0.15)" }}>
            <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em" }}>🎵 SOUND PAD</span>
            {playing.size > 0 && (
              <button
                onClick={stopAll}
                style={{ fontSize: "10px", color: "#f87171", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", padding: "2px 8px", cursor: "pointer" }}
              >
                ■ 全停止
              </button>
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
                    <span style={{ fontSize: "9px", color: "#6bcab7", flexShrink: 0 }}>▶</span>
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
