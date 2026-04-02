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
interface Config {
  title: string;
}

// 月桂樹SVG（片側）
function LaurelBranch({ flip }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 90 180"
      style={{
        width: "clamp(60px,8vw,120px)",
        height: "auto",
        transform: flip ? "scaleX(-1)" : undefined,
        filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
      }}
    >
      {/* 枝の幹 */}
      <path d="M45,170 Q38,130 30,90 Q22,50 35,10" stroke="#5a7a2a" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* 葉（左側） */}
      {[
        { cx: 38, cy: 150, rx: 16, ry: 9, rot: -40 },
        { cx: 31, cy: 125, rx: 16, ry: 9, rot: -50 },
        { cx: 26, cy: 100, rx: 15, ry: 8, rot: -55 },
        { cx: 24, cy: 76,  rx: 14, ry: 8, rot: -60 },
        { cx: 26, cy: 52,  rx: 13, ry: 7, rot: -55 },
        { cx: 30, cy: 30,  rx: 12, ry: 6, rot: -45 },
      ].map((l, i) => (
        <ellipse
          key={i} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry}
          fill={i % 2 === 0 ? "#6a9e30" : "#4e7a20"}
          transform={`rotate(${l.rot}, ${l.cx}, ${l.cy})`}
          opacity="0.9"
        />
      ))}
      {/* 葉（右側） */}
      {[
        { cx: 52, cy: 155, rx: 14, ry: 8, rot: 35 },
        { cx: 56, cy: 130, rx: 14, ry: 8, rot: 40 },
        { cx: 55, cy: 106, rx: 13, ry: 7, rot: 45 },
        { cx: 52, cy: 82,  rx: 12, ry: 7, rot: 50 },
        { cx: 48, cy: 58,  rx: 11, ry: 6, rot: 48 },
      ].map((l, i) => (
        <ellipse
          key={i} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry}
          fill={i % 2 === 0 ? "#5a8e28" : "#7ab838"}
          transform={`rotate(${l.rot}, ${l.cx}, ${l.cy})`}
          opacity="0.85"
        />
      ))}
    </svg>
  );
}

export default function JudgeWinnerPage() {
  const [winners, setWinners] = useState<Candidate[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/judge"), fetch("/api/config")])
      .then(([jr, cr]) => Promise.all([jr.json(), cr.json()]))
      .then(([judgeData, configData]: [JudgeData, Config]) => {
        setEventTitle(configData.title ?? "");
        const tally: Record<string, number> = {};
        for (const v of judgeData.judgeVotes) {
          tally[v.selectedProductId] = (tally[v.selectedProductId] ?? 0) + 1;
        }
        const maxVotes = Math.max(0, ...Object.values(tally));
        if (maxVotes > 0) {
          const winnerIds = Object.entries(tally)
            .filter(([, c]) => c === maxVotes)
            .map(([id]) => id);
          const winnerCandidates = winnerIds.map((id) => {
            const from = judgeData.results?.find((r) => r.productId === id)
              ?? judgeData.candidates?.find((c) => c.productId === id);
            return from ? { productId: id, productNumber: from.productNumber } : null;
          }).filter((c): c is Candidate => c !== null);
          setWinners(winnerCandidates);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main style={{ background: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #c8900a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      padding: "clamp(24px,4vh,60px) clamp(16px,4vw,60px)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* 背景の微細なグロー */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 60%, rgba(180,100,0,0.12) 0%, transparent 65%)",
      }} />

      {/* イベントタイトル */}
      <p style={{
        color: "#ff7a6a",
        fontSize: "clamp(28px,4.5vw,72px)",
        fontWeight: 900,
        letterSpacing: "0.12em",
        textAlign: "center",
        marginBottom: "clamp(24px,4vh,56px)",
        textShadow: "0 0 20px rgba(255,100,80,0.4)",
        position: "relative", zIndex: 1,
      }}>
        {eventTitle}
      </p>

      {/* 優勝＋月桂樹エリア */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "clamp(12px,2vw,32px)",
        marginBottom: "clamp(16px,2.5vh,36px)",
        position: "relative", zIndex: 1,
      }}>
        <LaurelBranch />

        <div style={{ textAlign: "center" }}>
          {/* 優勝テキスト（3D金文字） */}
          <p style={{
            color: "#f0c030",
            fontSize: "clamp(72px,12vw,180px)",
            fontWeight: 900,
            letterSpacing: "0.15em",
            lineHeight: 1,
            textShadow: [
              "2px 2px 0 #b8860b",
              "4px 4px 0 #9a7020",
              "6px 6px 0 #7a5000",
              "8px 8px 0 #5a3800",
              "10px 10px 20px rgba(0,0,0,0.9)",
              "0 0 40px rgba(255,200,50,0.6)",
              "0 0 80px rgba(255,150,0,0.3)",
            ].join(", "),
            animation: "goldPulse 2.5s ease-in-out infinite alternate",
          }}>
            優&nbsp;勝
          </p>

          {/* 星 */}
          <p style={{
            color: "#c8900a",
            fontSize: "clamp(16px,2vw,28px)",
            letterSpacing: "0.4em",
            marginTop: "4px",
            textShadow: "0 0 10px rgba(200,144,10,0.8)",
          }}>
            ★★★★
          </p>
        </div>

        <LaurelBranch flip />
      </div>

      {/* 受賞作品名 */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        {winners.length > 0 ? winners.map((w) => (
          <p key={w.productId} style={{
            color: "#ffffff",
            fontSize: "clamp(28px,4.5vw,72px)",
            fontWeight: 900,
            letterSpacing: "0.06em",
            lineHeight: 1.3,
            textShadow: "0 2px 20px rgba(255,255,255,0.3), 0 0 60px rgba(255,200,100,0.2)",
            animation: "fadeInUp 0.8s ease-out both",
          }}>
            {w.productNumber.split("\n").map((line, i) => (
              <span key={i} style={{ display: "block" }}>{line}</span>
            ))}
          </p>
        )) : (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "clamp(16px,2vw,24px)" }}>
            まだ投票データがありません
          </p>
        )}
      </div>

      {/* 戻るリンク */}
      <a
        href="/judge/announce"
        style={{
          position: "fixed", bottom: "20px", right: "24px",
          color: "rgba(255,255,255,0.2)",
          fontSize: "clamp(10px,0.85vw,13px)",
          textDecoration: "none",
          transition: "color 0.2s",
          zIndex: 10,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
      >
        ← 審査発表へ
      </a>

      <style>{`
        @keyframes goldPulse {
          from { text-shadow: 2px 2px 0 #b8860b, 4px 4px 0 #9a7020, 6px 6px 0 #7a5000, 8px 8px 0 #5a3800, 10px 10px 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,200,50,0.5), 0 0 80px rgba(255,150,0,0.2); }
          to   { text-shadow: 2px 2px 0 #b8860b, 4px 4px 0 #9a7020, 6px 6px 0 #7a5000, 8px 8px 0 #5a3800, 10px 10px 20px rgba(0,0,0,0.9), 0 0 80px rgba(255,220,80,0.9), 0 0 140px rgba(255,180,0,0.5); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
