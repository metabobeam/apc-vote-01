"use client";

import { useEffect, useState } from "react";

interface Candidate {
  productId: string;
  productNumber: string;
}
interface JudgeData {
  candidates: Candidate[];
  judgeVotes: { judgeName: string; selectedProductId: string }[];
  results: { productId: string; productNumber: string; judgeVoteCount: number }[];
}

// 桜の花びら（5枚花弁）
function SakuraFlower({ size, color, rotate }: { size: number; color: string; rotate: number }) {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 * Math.PI) / 180;
    const cx = 12 + Math.cos(angle - Math.PI / 2) * 5;
    const cy = 12 + Math.sin(angle - Math.PI / 2) * 5;
    return (
      <ellipse key={i} cx={cx} cy={cy} rx={3.2} ry={5.5}
        transform={`rotate(${i * 72 - 90 + 90}, ${cx}, ${cy})`}
        fill={color} opacity="0.88" />
    );
  });
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      style={{ transform: `rotate(${rotate}deg)`, display: "block" }}>
      {petals}
      <circle cx="12" cy="12" r="2.2" fill="#fff0f5" opacity="0.9" />
      <circle cx="12" cy="12" r="1" fill="#ffb7c5" opacity="1" />
    </svg>
  );
}

function SakuraPetal({ x, delay, duration, size, rotate, color }: {
  x: number; delay: number; duration: number; size: number; rotate: number; color: string;
}) {
  return (
    <div style={{
      position: "fixed", top: "-50px", left: `${x}%`, zIndex: 5, pointerEvents: "none",
      width: `${size}px`, height: `${size}px`,
      animation: `sakuraFall ${duration}s ${delay}s ease-in-out infinite`,
    }}>
      <SakuraFlower size={size} color={color} rotate={rotate} />
    </div>
  );
}

// 月桂樹SVG
function LaurelBranch({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 90 200" style={{
      width: "clamp(50px,7vw,110px)", height: "auto",
      transform: flip ? "scaleX(-1)" : undefined,
      filter: "drop-shadow(0 0 8px rgba(120,180,40,0.5))",
    }}>
      <path d="M45,185 Q38,140 30,95 Q22,50 35,12" stroke="#4a6a1a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {[
        { cx: 38, cy: 160, rx: 17, ry: 10, rot: -40 },
        { cx: 31, cy: 133, rx: 17, ry: 9,  rot: -50 },
        { cx: 26, cy: 107, rx: 16, ry: 9,  rot: -55 },
        { cx: 24, cy: 82,  rx: 15, ry: 8,  rot: -60 },
        { cx: 26, cy: 57,  rx: 14, ry: 8,  rot: -55 },
        { cx: 30, cy: 34,  rx: 13, ry: 7,  rot: -45 },
        { cx: 36, cy: 15,  rx: 11, ry: 6,  rot: -35 },
      ].map((l, i) => (
        <ellipse key={`l${i}`} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry}
          fill={i % 2 === 0 ? "#72a832" : "#527820"}
          transform={`rotate(${l.rot}, ${l.cx}, ${l.cy})`} opacity="0.92" />
      ))}
      {[
        { cx: 53, cy: 165, rx: 15, ry: 8,  rot: 35 },
        { cx: 57, cy: 138, rx: 15, ry: 8,  rot: 42 },
        { cx: 55, cy: 112, rx: 14, ry: 7,  rot: 47 },
        { cx: 52, cy: 87,  rx: 13, ry: 7,  rot: 52 },
        { cx: 48, cy: 62,  rx: 12, ry: 6,  rot: 48 },
        { cx: 44, cy: 38,  rx: 11, ry: 6,  rot: 42 },
      ].map((l, i) => (
        <ellipse key={`r${i}`} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry}
          fill={i % 2 === 0 ? "#62981e" : "#82b838"}
          transform={`rotate(${l.rot}, ${l.cx}, ${l.cy})`} opacity="0.88" />
      ))}
    </svg>
  );
}

const SAKURA_COLORS = ["#ffb7c5","#ffc8d5","#ff8fab","#ffccd5","#ffdde1","#ff99aa","#ffe4e8"];

// 花びらデータを固定生成（再レンダーで変化しないよう）
const PETALS = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  x: (i * 31 + 7) % 100,
  delay: (i * 0.55) % 12,
  duration: 8 + (i % 6) * 1.2,
  size: 18 + (i % 5) * 5,
  rotate: (i * 53) % 360,
  color: SAKURA_COLORS[i % SAKURA_COLORS.length],
}));

export default function JudgeWinnerPage() {
  const [winners, setWinners] = useState<Candidate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showWreath, setShowWreath] = useState(false);
  const [showWinner, setShowWinner] = useState(false);

  useEffect(() => {
    fetch("/api/judge")
      .then((r) => r.json())
      .then((judgeData: JudgeData) => {
        const tally: Record<string, number> = {};
        for (const v of judgeData.judgeVotes ?? []) {
          tally[v.selectedProductId] = (tally[v.selectedProductId] ?? 0) + 1;
        }
        const maxVotes = Math.max(0, ...Object.values(tally));
        if (maxVotes > 0) {
          const winnerIds = Object.entries(tally)
            .filter(([, c]) => c === maxVotes).map(([id]) => id);
          const winnerCandidates = winnerIds.map((id) => {
            const from = judgeData.results?.find((r) => r.productId === id)
              ?? judgeData.candidates?.find((c) => c.productId === id);
            return from ? { productId: id, productNumber: from.productNumber } : null;
          }).filter((c): c is Candidate => c !== null);
          setWinners(winnerCandidates);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoaded(true);
        // 演出タイミング
        setTimeout(() => setShowTitle(true), 100);
        setTimeout(() => setShowWreath(true), 600);
        setTimeout(() => setShowWinner(true), 1200);
      });
  }, []);

  if (!loaded) {
    return (
      <main style={{ background: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #c8900a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </main>
    );
  }

  return (
    <main style={{
      background: "#000000",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "clamp(32px,5vh,80px) clamp(20px,5vw,80px)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* 背景の放射グロー */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: [
          "radial-gradient(ellipse at 50% 45%, rgba(200,120,0,0.10) 0%, transparent 55%)",
          "radial-gradient(ellipse at 20% 80%, rgba(255,140,140,0.05) 0%, transparent 40%)",
          "radial-gradient(ellipse at 80% 80%, rgba(255,140,140,0.05) 0%, transparent 40%)",
        ].join(","),
      }} />

      {/* 継続的な桜吹雪（少なめ） */}
      {PETALS.map((p) => (
        <SakuraPetal key={p.id} x={p.x} delay={p.delay} duration={p.duration}
          size={p.size} rotate={p.rotate} color={p.color} />
      ))}

      {/* イベントタイトル */}
      <p style={{
        color: "#ff7a6a",
        fontSize: "clamp(24px,3.8vw,60px)",
        fontWeight: 900,
        letterSpacing: "0.14em",
        textAlign: "center",
        marginBottom: "clamp(28px,4.5vh,64px)",
        textShadow: "0 0 30px rgba(255,100,80,0.5), 0 2px 8px rgba(0,0,0,0.8)",
        position: "relative", zIndex: 10,
        opacity: showTitle ? 1 : 0,
        transform: showTitle ? "translateY(0)" : "translateY(-20px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}>
        APC全国大会 2026
      </p>

      {/* 優勝＋月桂樹 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "clamp(16px,3vw,48px)",
        marginBottom: "clamp(20px,3.5vh,52px)",
        position: "relative", zIndex: 10,
        opacity: showWreath ? 1 : 0,
        transform: showWreath ? "scale(1)" : "scale(0.7)",
        transition: "opacity 0.6s cubic-bezier(0.34,1.56,0.64,1), transform 0.6s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <LaurelBranch />

        <div style={{ textAlign: "center" }}>
          <p style={{
            color: "#f0c030",
            fontSize: "clamp(80px,13vw,200px)",
            fontWeight: 900,
            letterSpacing: "0.18em",
            lineHeight: 1,
            textShadow: [
              "2px 2px 0 #b8860b",
              "4px 4px 0 #9a7020",
              "6px 6px 0 #7a5000",
              "8px 8px 0 #5a3800",
              "10px 10px 0 #3a2000",
              "12px 12px 24px rgba(0,0,0,0.95)",
              "0 0 50px rgba(255,210,60,0.7)",
              "0 0 100px rgba(255,160,0,0.4)",
            ].join(", "),
            animation: "goldPulse 2.8s ease-in-out infinite alternate",
          }}>
            優&nbsp;勝
          </p>
          <p style={{
            color: "#c8900a",
            fontSize: "clamp(18px,2.2vw,32px)",
            letterSpacing: "0.5em",
            marginTop: "clamp(4px,0.6vh,10px)",
            textShadow: "0 0 14px rgba(200,144,10,0.9)",
            animation: "starPulse 1.8s ease-in-out infinite alternate",
          }}>
            ★★★★
          </p>
        </div>

        <LaurelBranch flip />
      </div>

      {/* 受賞作品名 */}
      <div style={{
        textAlign: "center",
        position: "relative", zIndex: 10,
        opacity: showWinner ? 1 : 0,
        transform: showWinner ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}>
        {winners.length > 0 ? winners.map((w) => (
          <div key={w.productId}>
            {w.productNumber.split("\n").map((line, i) => (
              <p key={i} style={{
                color: "#ffffff",
                fontSize: "clamp(26px,4.2vw,68px)",
                fontWeight: 900,
                letterSpacing: "0.06em",
                lineHeight: 1.4,
                textShadow: [
                  "0 2px 16px rgba(255,255,255,0.25)",
                  "0 0 60px rgba(255,210,100,0.2)",
                  "0 4px 20px rgba(0,0,0,0.8)",
                ].join(", "),
              }}>
                {line}
              </p>
            ))}
          </div>
        )) : (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "clamp(14px,1.8vw,22px)" }}>
            まだ投票データがありません
          </p>
        )}
      </div>

      {/* 戻るリンク */}
      <a
        href="/judge/announce"
        style={{
          position: "fixed", bottom: "18px", right: "22px",
          color: "rgba(255,255,255,0.18)",
          fontSize: "11px",
          textDecoration: "none",
          transition: "color 0.2s",
          zIndex: 20,
          letterSpacing: "0.05em",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}
      >
        ← 審査発表へ
      </a>

      <style>{`
        @keyframes goldPulse {
          from { text-shadow: 2px 2px 0 #b8860b, 4px 4px 0 #9a7020, 6px 6px 0 #7a5000, 8px 8px 0 #5a3800, 10px 10px 0 #3a2000, 12px 12px 24px rgba(0,0,0,0.95), 0 0 50px rgba(255,210,60,0.5), 0 0 100px rgba(255,160,0,0.25); }
          to   { text-shadow: 2px 2px 0 #b8860b, 4px 4px 0 #9a7020, 6px 6px 0 #7a5000, 8px 8px 0 #5a3800, 10px 10px 0 #3a2000, 12px 12px 24px rgba(0,0,0,0.95), 0 0 90px rgba(255,230,80,1), 0 0 180px rgba(255,180,0,0.6); }
        }
        @keyframes starPulse {
          from { opacity: 0.6; }
          to   { opacity: 1; text-shadow: 0 0 20px rgba(200,144,10,1), 0 0 40px rgba(255,200,0,0.6); }
        }
        @keyframes sakuraFall {
          0%   { transform: translateY(-50px) rotate(0deg) translateX(0px);   opacity: 0; }
          5%   { opacity: 0.85; }
          25%  { transform: translateY(25vh)  rotate(90deg)  translateX(18px);  opacity: 0.8; }
          50%  { transform: translateY(52vh)  rotate(185deg) translateX(-14px); opacity: 0.7; }
          75%  { transform: translateY(77vh)  rotate(275deg) translateX(20px);  opacity: 0.5; }
          95%  { opacity: 0.2; }
          100% { transform: translateY(108vh) rotate(360deg) translateX(0px);   opacity: 0; }
        }
      `}</style>
    </main>
  );
}
