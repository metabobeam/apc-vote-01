"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_CRITERIA_LABELS } from "@/lib/types";

// 桜の花びら（5枚花弁、先端に切れ込み）
const SAKURA_COLORS = ["#ffb7c5","#ffc8d5","#ff8fab","#ffccd5","#ffdde1","#ff99aa","#ffe4e8","#ffa0b4"];

function SakuraFlower({ size, color, rotate }: { size: number; color: string; rotate: number }) {
  // 5枚の花びらを回転させて描画
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 * Math.PI) / 180;
    const cx = 12 + Math.cos(angle - Math.PI / 2) * 5;
    const cy = 12 + Math.sin(angle - Math.PI / 2) * 5;
    const rx = 3.2;
    const ry = 5.5;
    const rot = (i * 72) - 90;
    return (
      <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
        transform={`rotate(${rot + 90}, ${cx}, ${cy})`}
        fill={color} opacity="0.9" />
    );
  });
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ transform: `rotate(${rotate}deg)`, display: "block" }}>
      {petals}
      {/* 花芯 */}
      <circle cx="12" cy="12" r="2.2" fill="#ffe4e8" opacity="0.95" />
      <circle cx="12" cy="12" r="1" fill="#ffb7c5" opacity="1" />
    </svg>
  );
}

function SakuraPetal({ x, delay, duration, size, rotate, color }: { x: number; delay: number; duration: number; size: number; rotate: number; color: string }) {
  return (
    <div style={{
      position: "fixed", top: "-40px", left: `${x}%`, zIndex: 50, pointerEvents: "none",
      width: `${size}px`, height: `${size}px`,
      animation: `sakuraFall ${duration}s ${delay}s linear forwards`,
    }}>
      <SakuraFlower size={size} color={color} rotate={rotate} />
    </div>
  );
}

interface ReviewResult {
  productId: string;
  productNumber: string;
  totalScore: number;
  scores: { criterion1: number; criterion2: number; criterion3: number; total: number }[];
}

interface PageData {
  criteriaLabels: [string, string, string];
  results: ReviewResult[];
}

interface Award {
  criterionIdx: number;
  awardName: string;
  description: string;
  winnerName: string;
  score: number;
  maxScore: number;
}

type Phase = "standby" | "revealing" | "finished";

const SESSION_KEY = "review_announce_state";

const AWARD_THEMES = [
  { bg: "linear-gradient(135deg,#1e3a5f,#1d4ed8,#2563eb)", accent: "#93c5fd", glow: "rgba(96,165,250,0.5)", badge: "#3b82f6", line: "#60a5fa" },
  { bg: "linear-gradient(135deg,#3b1a5f,#7c3aed,#9333ea)", accent: "#d8b4fe", glow: "rgba(167,139,250,0.5)", badge: "#8b5cf6", line: "#a78bfa" },
  { bg: "linear-gradient(135deg,#064e3b,#047857,#059669)", accent: "#6ee7b7", glow: "rgba(52,211,153,0.5)", badge: "#10b981", line: "#34d399" },
];

export default function ReviewAnnouncePage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [awards, setAwards] = useState<Award[]>([]);
  const [phase, setPhase] = useState<Phase>("standby");
  const [revealedCount, setRevealedCount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [flipIdx, setFlipIdx] = useState<number | null>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [sakuraList, setSakuraList] = useState<{ id: number; x: number; delay: number; duration: number; size: number; rotate: number; color: string }[]>([]);
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/review");
      if (!res.ok) throw new Error();
      const json = (await res.json()) as PageData;
      setData(json);
      const withC = json.results.map((r) => ({
        ...r,
        c: [
          r.scores.reduce((s, x) => s + x.criterion1, 0),
          r.scores.reduce((s, x) => s + x.criterion2, 0),
          r.scores.reduce((s, x) => s + x.criterion3, 0),
        ],
        n: r.scores.length,
      }));
      const computed: Award[] = [0, 1, 2].map((ci) => {
        const sorted = [...withC].sort((a, b) =>
          b.c[ci] !== a.c[ci] ? b.c[ci] - a.c[ci] : b.totalScore - a.totalScore
        );
        const winner = sorted[0];
        return {
          criterionIdx: ci,
          awardName: json.criteriaLabels?.[ci] ?? `項目${ci + 1}`,
          description: DEFAULT_CRITERIA_LABELS[ci],
          winnerName: winner?.productNumber ?? "—",
          score: winner?.c[ci] ?? 0,
          maxScore: (winner?.n ?? 0) * 5,
        };
      });
      setAwards(computed);

      // セッション復元
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          const { phase: savedPhase, revealedCount: savedCount } = JSON.parse(saved) as { phase: Phase; revealedCount: number };
          if (savedPhase === "revealing" || savedPhase === "finished") {
            setPhase(savedPhase);
            setRevealedCount(savedCount);
            if (savedPhase === "finished") {
              // 桜は再生成
              setTimeout(() => startSakura(), 100);
            }
          }
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // phase / revealedCount が変わったらセッションに保存
  useEffect(() => {
    if (phase === "standby") return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ phase, revealedCount }));
    } catch { /* ignore */ }
  }, [phase, revealedCount]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 全花びらを一括生成（CSS animation-delay で時間分散）→ setInterval不要
  const startSakura = useCallback(() => {
    const petals = Array.from({ length: 110 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 14,          // 0〜14秒の間に分散
      duration: 4 + Math.random() * 3.5,
      size: 20 + Math.floor(Math.random() * 24),
      rotate: Math.floor(Math.random() * 360),
      color: SAKURA_COLORS[Math.floor(Math.random() * SAKURA_COLORS.length)],
    }));
    setSakuraList(petals);                 // 1回のみ state 更新
  }, []);

  const handleStart = () => { setPhase("revealing"); setRevealedCount(0); };

  const handleRevealNext = () => {
    if (animating || revealedCount >= awards.length) return;
    const idx = revealedCount;
    setAnimating(true);
    setFlipIdx(idx);
    // フラッシュ：90度になる直前
    setTimeout(() => {
      setFlashIdx(idx);
      setTimeout(() => setFlashIdx(null), 350);
    }, 400);
    setTimeout(() => setRevealedCount((n) => n + 1), 450);
    setTimeout(() => {
      setFlipIdx(null);
      setAnimating(false);
      const next = idx + 1;
      if (next >= awards.length) {
        setTimeout(() => {
          setPhase("finished");
          startSakura();
        }, 700);
      }
    }, 900);
  };

  const handleReset = () => {
    setSakuraList([]);
    setFlashIdx(null);
    setPhase("standby");
    setRevealedCount(0);
    setFlipIdx(null);
    setAnimating(false);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  };

  if (loading) return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </main>
  );

  return (
    <main className="min-h-screen flex flex-col overflow-hidden relative"
      style={{ background: "linear-gradient(160deg,#04040f 0%,#0a0f1e 50%,#04040f 100%)" }}>

      {/* 背景の星 */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
            borderRadius: "50%", background: "white",
            left: `${(i * 17 + 3) % 100}%`, top: `${(i * 13 + 7) % 100}%`,
            opacity: 0.15 + (i % 5) * 0.1,
            animation: `twinkle ${2 + (i % 4)}s ${(i % 3) * 0.7}s ease-in-out infinite`,
          }} />
        ))}
      </div>

      {/* ─── 待機画面 ─── */}
      {phase === "standby" && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-8 px-8 text-center">
          <div>
            <p style={{ color: "#fbbf24", fontSize: "clamp(12px,1.5vw,20px)", fontWeight: 800, letterSpacing: "0.3em", marginBottom: "clamp(12px,2vh,24px)" }}>
              AWARD CEREMONY
            </p>
            <h1 style={{
              color: "white", fontWeight: 900, lineHeight: 1.1,
              fontSize: "clamp(48px,8vw,110px)", letterSpacing: "0.05em",
              textShadow: "0 0 40px rgba(251,191,36,0.4), 0 4px 20px rgba(0,0,0,0.5)",
            }}>
              討議班３賞<br />
              <span style={{ color: "#fbbf24", fontSize: "0.75em" }}>発表</span>
            </h1>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(8px,1.2vh,16px)", marginTop: "clamp(8px,1vh,16px)" }}>
            {awards.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "center" }}>
                <div style={{
                  width: "clamp(10px,1.2vw,16px)", height: "clamp(10px,1.2vw,16px)",
                  borderRadius: "50%", background: AWARD_THEMES[i].line,
                  boxShadow: `0 0 10px ${AWARD_THEMES[i].glow}`,
                }} />
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "clamp(18px,2.2vw,32px)", fontWeight: 700 }}>
                  {a.awardName}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(12px,1.5vh,20px)", marginTop: "clamp(16px,2vh,32px)" }}>
            <button
              onClick={handleStart}
              disabled={awards.length === 0 || awards[0].winnerName === "—"}
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "12px",
                padding: "10px 32px",
                fontSize: "clamp(13px,1.4vw,18px)", fontWeight: 600, cursor: "pointer",
                letterSpacing: "0.05em",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >
              発表開始
            </button>
            <a href="/kanri" style={{ color: "rgba(255,255,255,0.3)", fontSize: "clamp(12px,1.2vw,16px)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
              ← 管理画面にもどる
            </a>
          </div>
        </div>
      )}

      {/* ─── 発表・終了画面 ─── */}
      {(phase === "revealing" || phase === "finished") && (
        <div className="relative z-10 flex flex-col min-h-screen" style={{ padding: "clamp(16px,3vh,40px) 0" }}>

          {/* タイトル */}
          <div style={{ textAlign: "center", marginBottom: "clamp(12px,2vh,24px)", padding: "0 clamp(16px,3vw,48px)" }}>
            <p style={{ color: "#fbbf24", fontSize: "clamp(28px,5.6vw,84px)", fontWeight: 900, letterSpacing: "0.15em", lineHeight: 1, textShadow: "0 0 30px rgba(251,191,36,0.5)" }}>
              討議班３賞 発表
            </p>
          </div>

          {/* 賞カード */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "clamp(10px,1.5vh,20px)", justifyContent: "center" }}>
            {awards.map((award, idx) => {
              const revealed = idx < revealedCount;
              const isFlip = flipIdx === idx;
              const theme = AWARD_THEMES[idx];

              const isFlashing = flashIdx === idx;

              return (
                <div key={idx} style={{
                  borderRadius: 0, overflow: "hidden", position: "relative",
                  animation: isFlip
                    ? (revealed ? "flipIn 0.45s ease-in-out forwards" : "flipOut 0.45s ease-in-out forwards")
                    : (revealed ? "revealGlow 0.6s ease-out forwards" : "none"),
                  boxShadow: revealed
                    ? `0 0 clamp(20px,3vw,50px) ${theme.glow}, 0 8px 40px rgba(0,0,0,0.6)`
                    : "0 4px 20px rgba(0,0,0,0.4)",
                  flex: "1", width: "100%",
                  background: revealed ? theme.bg : undefined,
                  display: "flex",
                }}>
                  {/* フラッシュオーバーレイ */}
                  {isFlashing && (
                    <div style={{
                      position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none",
                      background: `radial-gradient(ellipse at 50% 50%, white 0%, ${theme.accent}cc 40%, transparent 75%)`,
                      animation: "flashBurst 0.35s ease-out forwards",
                    }} />
                  )}
                  {revealed ? (
                    /* 発表後 */
                    <div style={{
                      background: theme.bg,
                      padding: "clamp(20px,3vh,36px) clamp(24px,4vw,56px)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: "clamp(20px,4vw,56px)", flexWrap: "wrap",
                      position: "relative", overflow: "hidden",
                      flex: 1, width: "100%", boxSizing: "border-box",
                    }}>
                      {/* 背景の放射光 */}
                      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 50% 50%, ${theme.badge}40 0%, transparent 70%)` }} />
                      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(120deg,rgba(255,255,255,0.10) 0%,transparent 60%)" }} />
                      {/* 上下のアクセントライン */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${theme.line},transparent)` }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg,transparent,${theme.line}80,transparent)` }} />

                      {/* 賞名 */}
                      <p style={{
                        color: theme.accent, fontWeight: 800, lineHeight: 1.1, textAlign: "center",
                        fontSize: "clamp(34px,5.25vw,76px)", letterSpacing: "0.06em", position: "relative", zIndex: 1,
                        textShadow: `0 0 30px ${theme.glow}, 0 0 60px ${theme.glow}`,
                      }}>
                        {award.awardName}
                      </p>

                      {/* 縦区切り */}
                      <div style={{ width: "2px", height: "clamp(52px,8vh,108px)", background: `linear-gradient(180deg,transparent,${theme.line},transparent)`, flexShrink: 0, position: "relative", zIndex: 1 }} />

                      {/* 受賞班名 */}
                      <p style={{
                        color: "#ffffff", fontWeight: 900, lineHeight: 1.1, textAlign: "center",
                        fontSize: "clamp(48px,7.5vw,108px)", letterSpacing: "0.04em", position: "relative", zIndex: 1,
                        textShadow: `0 0 40px rgba(255,255,255,0.6), 0 0 80px ${theme.glow}`,
                      }}>
                        {award.winnerName}
                      </p>
                    </div>
                  ) : (
                    /* 発表前 */
                    <div style={{
                      background: `linear-gradient(135deg, #0d1117 0%, ${theme.badge}22 50%, #0d1117 100%)`,
                      width: "100%",
                      padding: "clamp(14px,2vh,24px) clamp(20px,3vw,40px)",
                      borderTop: `1.5px solid ${theme.line}55`,
                      borderBottom: `1.5px solid ${theme.line}55`,
                      borderLeft: `5px solid ${theme.line}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative", overflow: "hidden",
                    }}>
                      {/* 光沢オーバーレイ */}
                      <div style={{
                        position: "absolute", inset: 0, pointerEvents: "none",
                        background: `radial-gradient(ellipse at 50% 50%, ${theme.badge}18 0%, transparent 70%)`,
                      }} />
                      {/* 上下のアクセントライン */}
                      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: "1px", background: `linear-gradient(90deg, transparent, ${theme.line}80, transparent)` }} />
                      <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: "1px", background: `linear-gradient(90deg, transparent, ${theme.line}80, transparent)` }} />
                      <p style={{
                        color: theme.accent, fontSize: "clamp(31px,4.9vw,73px)", fontWeight: 800,
                        letterSpacing: "0.06em", textAlign: "center", position: "relative", zIndex: 1,
                        textShadow: `0 0 40px ${theme.glow}, 0 0 80px ${theme.glow}`,
                      }}>
                        {award.awardName}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 次へボタン */}
          {phase === "revealing" && revealedCount < awards.length && (
            <div style={{ textAlign: "center", marginTop: "clamp(12px,2vh,24px)", padding: "0 clamp(16px,3vw,48px)" }}>
              <button
                onClick={handleRevealNext}
                disabled={animating}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "12px", padding: "10px 32px",
                  fontSize: "clamp(13px,1.4vw,18px)", fontWeight: 600, cursor: "pointer",
                  letterSpacing: "0.05em", opacity: animating ? 0.3 : 1,
                  transition: "background 0.2s, color 0.2s",
                }}
                onMouseEnter={e => { if (!animating) { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >
                {revealedCount === 0
                  ? "最初の賞を発表"
                  : revealedCount === awards.length - 1
                  ? "最後の賞を発表"
                  : `次の賞を発表 (${revealedCount + 1}/${awards.length})`}
              </button>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: "clamp(8px,1.2vh,16px)", padding: "0 clamp(16px,3vw,48px)" }}>
            <a href="/kanri" style={{ color: "rgba(255,255,255,0.2)", fontSize: "clamp(10px,1vw,14px)", textDecoration: "none" }}>
              ← 管理画面にもどる
            </a>
          </div>
        </div>
      )}


      {/* 桜の花びら */}
      {sakuraList.map((p) => (
        <SakuraPetal key={p.id} x={p.x} delay={p.delay} duration={p.duration} size={p.size} rotate={p.rotate} color={p.color} />
      ))}

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.3; }
        }
        @keyframes flipOut {
          0%   { transform: perspective(800px) rotateY(0deg); }
          100% { transform: perspective(800px) rotateY(90deg); }
        }
        @keyframes flipIn {
          0%   { transform: perspective(800px) rotateY(-90deg); }
          100% { transform: perspective(800px) rotateY(0deg); }
        }
        @keyframes bounceIn {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes twinkle {
          0%,100% { opacity: 0.15; } 50% { opacity: 0.7; }
        }
        @keyframes textGlow {
          0%,100% { text-shadow: 0 0 20px rgba(251,191,36,0.6); }
          50%      { text-shadow: 0 0 50px rgba(251,191,36,1), 0 0 100px rgba(251,191,36,0.4); }
        }
        @keyframes flashBurst {
          0%   { opacity: 1; }
          60%  { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes revealGlow {
          0%   { filter: brightness(2.5) saturate(1.5); }
          100% { filter: brightness(1) saturate(1); }
        }
        @keyframes sakuraFall {
          0%   { transform: translateY(-30px) rotate(0deg) translateX(0px); opacity: 1; }
          25%  { transform: translateY(25vh) rotate(90deg) translateX(20px); opacity: 0.9; }
          50%  { transform: translateY(50vh) rotate(180deg) translateX(-15px); opacity: 0.8; }
          75%  { transform: translateY(75vh) rotate(270deg) translateX(25px); opacity: 0.6; }
          100% { transform: translateY(110vh) rotate(360deg) translateX(0px); opacity: 0; }
        }
      `}</style>
    </main>
  );
}
