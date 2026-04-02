"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Candidate {
  productId: string;
  productNumber: string;
  description: string;
  count: number;
}
interface JudgeVote { judgeName: string; selectedProductId: string; }
interface JudgeData {
  judges: string[];
  candidates: Candidate[];
  judgeVotes: JudgeVote[];
}
type Phase = "standby" | "revealing" | "finished";

const CANDIDATE_COLORS = [
  { bg: "linear-gradient(170deg,#0044ff,#0022cc,#001a99)", glow: "rgba(0,80,255,0.8)",  border: "#4488ff" },
  { bg: "linear-gradient(170deg,#cc7700,#aa5500,#884400)", glow: "rgba(255,160,0,0.8)",  border: "#ffbb44" },
  { bg: "linear-gradient(170deg,#bb0022,#880011,#660011)", glow: "rgba(220,0,50,0.8)",   border: "#ff4466" },
  { bg: "linear-gradient(170deg,#007744,#005533,#003322)", glow: "rgba(0,180,80,0.8)",   border: "#44cc88" },
  { bg: "linear-gradient(170deg,#6600bb,#4400aa,#330088)", glow: "rgba(140,0,255,0.8)",  border: "#aa66ff" },
  { bg: "linear-gradient(170deg,#006688,#004466,#002244)", glow: "rgba(0,160,220,0.8)",  border: "#44aadd" },
  { bg: "linear-gradient(170deg,#885500,#664400,#443300)", glow: "rgba(180,100,0,0.8)",  border: "#ddaa44" },
  { bg: "linear-gradient(170deg,#004488,#002266,#001144)", glow: "rgba(0,100,200,0.8)",  border: "#4488cc" },
];

// 王冠SVG
function CrownSvg({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 120 72" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
      <defs>
        <linearGradient id="goldA" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffe066" />
          <stop offset="40%"  stopColor="#c8900a" />
          <stop offset="100%" stopColor="#7a5200" />
        </linearGradient>
        <linearGradient id="goldB" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#fff0a0" />
          <stop offset="50%"  stopColor="#e0a820" />
          <stop offset="100%" stopColor="#9a6600" />
        </linearGradient>
        {lit && (
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
      </defs>

      {/* 台座 */}
      <rect x="8" y="58" width="104" height="12" rx="3" fill="url(#goldA)" stroke="#7a5200" strokeWidth="1"/>
      <rect x="12" y="61" width="96" height="5" rx="1" fill="rgba(255,255,255,0.15)" />

      {/* 王冠本体 */}
      <path d="M8,58 L8,32 L28,46 L44,8 L60,28 L76,8 L92,46 L112,32 L112,58 Z"
        fill="url(#goldB)" stroke="#8a6000" strokeWidth="1.5"
        filter={lit ? "url(#glow)" : undefined} />
      {/* 光沢 */}
      <path d="M8,58 L8,38 L22,48 L38,18 L44,8 L60,28 L76,8 L82,18 L98,48 L112,38 L112,58 Z"
        fill="rgba(255,255,255,0.1)" />

      {/* 先端の丸玉 */}
      {[[44,7],[60,27],[76,7]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="5.5"
          fill={i===1 ? "#3355ff" : "#dd2222"}
          stroke="#7a5200" strokeWidth="1"
          filter={lit ? "url(#glow)" : undefined} />
      ))}
      {/* 左右先端玉 */}
      <circle cx="8"  cy="32" r="4" fill="#cc8800" stroke="#7a5200" strokeWidth="1" />
      <circle cx="112" cy="32" r="4" fill="#cc8800" stroke="#7a5200" strokeWidth="1" />

      {/* 装飾ライン */}
      <line x1="8" y1="50" x2="112" y2="50" stroke="rgba(255,220,80,0.4)" strokeWidth="0.8"/>
    </svg>
  );
}

// 柱型パネル（発表前：審査員名表示）
function UnrevealedPanel({ name, idx }: { name: string; idx: number }) {
  return (
    <div className="relative w-full flex flex-col" style={{ height: "clamp(160px,calc(100vh - 260px),460px)" }}>
      {/* 左右の金柱 */}
      <div className="absolute top-0 bottom-0 left-0 w-[12%] flex flex-col"
        style={{ background: "linear-gradient(to right,#5a3800,#c8900a,#ffe066,#c8900a,#5a3800)" }}>
        <div className="flex-1" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.15) 0%,transparent 40%,rgba(0,0,0,0.3) 100%)" }} />
        {/* ボルト風飾り */}
        {[0.25, 0.5, 0.75].map((pos) => (
          <div key={pos} className="absolute w-full flex justify-center"
            style={{ top: `${pos * 100}%`, transform: "translateY(-50%)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "radial-gradient(circle,#ffe066,#7a5200)", border: "1px solid #5a3800" }} />
          </div>
        ))}
      </div>
      <div className="absolute top-0 bottom-0 right-0 w-[12%] flex flex-col"
        style={{ background: "linear-gradient(to left,#5a3800,#c8900a,#ffe066,#c8900a,#5a3800)" }}>
        <div className="flex-1" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.15) 0%,transparent 40%,rgba(0,0,0,0.3) 100%)" }} />
        {[0.25, 0.5, 0.75].map((pos) => (
          <div key={pos} className="absolute w-full flex justify-center"
            style={{ top: `${pos * 100}%`, transform: "translateY(-50%)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "radial-gradient(circle,#ffe066,#7a5200)", border: "1px solid #5a3800" }} />
          </div>
        ))}
      </div>

      {/* 中央パネル（上下トリム付き） */}
      <div className="absolute inset-x-[11%] inset-y-0 flex flex-col">
        {/* 上トリム */}
        <div style={{ height: "10px", background: "linear-gradient(180deg,#c8900a,#7a5200)", borderBottom: "1px solid #ffe066" }} />
        {/* メインエリア */}
        <div className="flex-1 flex items-center justify-center"
          style={{ background: "linear-gradient(160deg,#1a1a1a 0%,#111111 60%,#0d0d0d 100%)" }}>
          <p className="font-black text-white text-center leading-tight"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              fontSize: "clamp(54px,8.4vw,96px)",
              letterSpacing: "0.12em",
              textShadow: "0 2px 10px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.15)",
            }}>
            {name}
          </p>
        </div>
        {/* 下トリム */}
        <div style={{ height: "10px", background: "linear-gradient(0deg,#c8900a,#7a5200)", borderTop: "1px solid #ffe066" }} />
      </div>
    </div>
  );
}

export default function JudgeAnnouncePage() {
  const [data, setData]           = useState<JudgeData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [phase, setPhase]         = useState<Phase>("standby");
  const [revealedCount, setRevealedCount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 音声プリロード（初回マウント時）
  useEffect(() => {
    const audio = new Audio("/panel-flip-sound.mp3");
    audio.preload = "auto";
    audioRef.current = audio;
    return () => { audioRef.current = null; };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/judge");
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const orderedVotes = (data?.judges ?? [])
    .map((name) => {
      const jv = data?.judgeVotes.find((v) => v.judgeName === name);
      if (!jv) return null;
      return { ...jv, candidate: data?.candidates.find((c) => c.productId === jv.selectedProductId) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const candidateColorMap: Record<string, number> = {};
  (data?.candidates ?? []).forEach((c, i) => { candidateColorMap[c.productId] = i % CANDIDATE_COLORS.length; });

  const tally: Record<string, number> = {};
  for (const v of orderedVotes) tally[v.selectedProductId] = (tally[v.selectedProductId] ?? 0) + 1;
  const maxVotes = Math.max(0, ...Object.values(tally));
  const winnerIds = Object.entries(tally).filter(([, c]) => c === maxVotes && maxVotes > 0).map(([id]) => id);

  const handleRevealNext = () => {
    if (animating || revealedCount >= orderedVotes.length) return;
    // パネルをめくると同時に音を再生（遅延なし）
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    setAnimating(true);
    setRevealedCount((n) => n + 1);
    // フリップ開始後 300ms でボタン解除（捲れ始めたらすぐ次を押せる）
    setTimeout(() => {
      setAnimating(false);
      if (revealedCount + 1 >= orderedVotes.length) setTimeout(() => setPhase("finished"), 300);
    }, 300);
  };

  const handleStart = () => { setPhase("revealing"); setRevealedCount(0); };
  const handleReset = () => { setPhase("standby"); setRevealedCount(0); setAnimating(false); fetchData(); };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#05050f" }}>
      <p className="text-amber-400 animate-pulse">読み込み中...</p>
    </main>
  );
  if (!data || orderedVotes.length === 0) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#05050f" }}>
      <p className="text-gray-400">審査員の投票がまだありません</p>
      <a href="/judge" className="text-indigo-400 text-sm">← 審査員投票ページへ</a>
    </main>
  );

  // 紙吹雪パーティクル
  const CONFETTI_COLORS = ["#ff4444","#ffcc00","#44aaff","#ff44cc","#44ff88","#ff8800","#aa44ff","#ffffff"];
  function ConfettiPiece({ index }: { index: number }) {
    const color  = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    const left   = `${(index * 7.3 + 3) % 96}%`;
    const delay  = `${(index * 0.17) % 3}s`;
    const dur    = `${2.5 + (index % 5) * 0.5}s`;
    const width  = `${8 + (index % 5) * 3}px`;
    const height = `${5 + (index % 3) * 3}px`;
    const rotate = `${(index * 47) % 360}deg`;
    return (
      <div className="absolute top-0 pointer-events-none"
        style={{
          left, width, height,
          background: color,
          borderRadius: index % 3 === 0 ? "50%" : "2px",
          transform: `rotate(${rotate})`,
          animation: `confettiFall ${dur} ${delay} ease-in forwards`,
          opacity: 0.9,
        }} />
    );
  }

  return (
    <main className="h-screen flex flex-col items-center justify-between py-4 px-4 overflow-hidden relative"
      style={{
        background: [
          "radial-gradient(ellipse at 20% 100%,rgba(180,30,0,0.45) 0%,transparent 45%)",
          "radial-gradient(ellipse at 80% 100%,rgba(180,30,0,0.45) 0%,transparent 45%)",
          "radial-gradient(ellipse at 50% 50%,rgba(60,0,100,0.35) 0%,transparent 60%)",
          "linear-gradient(to top,#0a0200 0%,#08080f 40%,#05050f 100%)",
        ].join(","),
      }}>

      {/* 紙吹雪オーバーレイ（優勝時のみ） */}
      {phase === "finished" && winnerIds.length > 0 && (
        <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
          {Array.from({ length: 120 }).map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}
        </div>
      )}

      {/* 背景きらめき */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: `${2+(i%3)}px`, height: `${2+(i%3)}px`,
              left: `${(i*37+10)%90+5}%`, top: `${(i*53+5)%80+5}%`,
              background: i%3===0?"#ffcc44":i%3===1?"#4488ff":"#ff4488",
              opacity: 0.1+(i%5)*0.05,
              animation: `twinkle ${2+(i%4)}s ease-in-out ${i*0.3}s infinite alternate`,
            }} />
        ))}
      </div>

      {/* ヘッダー（発表中・終了時のみ表示） */}
      {phase !== "standby" && (
        <div className="relative z-10 text-center mb-4 w-full">
          <div className="inline-flex items-center gap-3 mb-1">
            <div className="h-px w-8 sm:w-16 bg-gradient-to-r from-transparent to-amber-400" />
            <p className="text-amber-400 text-xs font-black tracking-[0.4em] uppercase">Judge Announce</p>
            <div className="h-px w-8 sm:w-16 bg-gradient-to-l from-transparent to-amber-400" />
          </div>
          <h1 className="font-black text-white"
            style={{
              fontSize: "clamp(4rem,12vw,7rem)",
              textShadow: "0 0 40px rgba(255,160,50,1),0 0 80px rgba(255,100,0,0.6),0 3px 8px rgba(0,0,0,0.9)",
              letterSpacing: "0.1em",
            }}>
            審査発表
          </h1>
        </div>
      )}

      {/* 待機画面 */}
      {phase === "standby" && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center">

          {/* 横書き「審査発表」メインタイトル */}
          <h1
            className="font-black text-white"
            style={{
              fontSize: "clamp(8rem,22vw,14rem)",
              letterSpacing: "0.12em",
              lineHeight: 1,
              textShadow: "0 0 60px rgba(255,160,50,1), 0 0 120px rgba(255,100,0,0.7), 0 4px 16px rgba(0,0,0,0.9)",
              animation: "textGlow 2s ease-in-out infinite alternate",
            }}
          >
            審査発表
          </h1>

          <p className="text-amber-100/50 text-sm mt-6">
            審査員 <span className="text-white/70 font-bold">{orderedVotes.length}</span> 名の投票が完了しています
          </p>

          {/* 右下固定：発表開始ボタン＋管理画面リンク */}
          <div className="fixed bottom-6 right-8 flex flex-col items-end gap-2 z-20">
            <button onClick={handleStart}
              className="font-normal rounded-lg transition-all hover:opacity-80 active:scale-95"
              style={{
                background: "rgba(60,60,60,0.6)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#9ca3af",
                fontSize: "clamp(11px,1vw,14px)",
                padding: "8px 20px",
                letterSpacing: "0.05em",
              }}>
              🎤 発表開始
            </button>
            <a
              href="/kanri"
              className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
              ← 管理画面にもどる
            </a>
          </div>
        </div>
      )}

      {/* 発表中 / 終了 */}
      {(phase === "revealing" || phase === "finished") && (
        <div className="relative z-10 flex-1 w-full flex flex-col items-center gap-2 overflow-hidden">

          {/* 優勝バナー（ヘッダーとパネルの間） */}
          {phase === "finished" && winnerIds.length > 0 && (
            <div className="w-full text-center py-1 relative z-10"
              style={{ animation: "winnerPop 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.3s both" }}>
              {winnerIds.map((id) => {
                const c = data!.candidates.find((cc) => cc.productId === id);
                return c ? (
                  <p key={id} className="font-black whitespace-nowrap"
                    style={{
                      fontSize: "clamp(1.4rem,3.5vw,2.8rem)",
                      color: "#fff",
                      textShadow: "0 0 40px rgba(255,220,50,1), 0 0 80px rgba(255,150,0,0.8), 0 2px 8px rgba(0,0,0,0.9)",
                      letterSpacing: "0.08em",
                      animation: "textGlow 1.5s ease-in-out 1s infinite alternate",
                    }}>
                    優勝　{c.productNumber.replace(/\n/g, "　")}
                  </p>
                ) : null;
              })}
            </div>
          )}

          {/* パネル群 */}
          <div className="w-full flex-1 flex flex-col justify-center px-2">
            <div className="flex gap-1 sm:gap-2 justify-center w-full">
              {orderedVotes.map((vote, idx) => {
                const revealed  = idx < revealedCount;
                const isWinner  = revealed && phase==="finished" && winnerIds.includes(vote.selectedProductId);
                const colorIdx  = candidateColorMap[vote.selectedProductId] ?? 0;
                const color     = CANDIDATE_COLORS[colorIdx];
                const candidate = vote.candidate;

                return (
                  <div key={vote.judgeName} className="flex-1 min-w-0 flex flex-col items-center"
                    style={{ maxWidth:"160px" }}>

                    {/* 王冠 */}
                    <div className="w-full"
                      style={{
                        filter: isWinner
                          ? "drop-shadow(0 0 12px rgba(255,220,50,1))"
                          : revealed
                            ? `drop-shadow(0 0 6px ${color.glow})`
                            : "brightness(0.85)",
                        transform: isWinner ? "scale(1.05)" : "scale(1)",
                        transition: "filter 0.5s ease, transform 0.5s ease",
                      }}>
                      <CrownSvg lit={revealed} />
                    </div>

                    {/* パネル本体（CSS 3D フリップ） */}
                    {/* perspective ラッパー */}
                    <div style={{
                      width: "100%",
                      perspective: "900px",
                      // 次に発表されるパネルをGPUに先読みさせる
                      willChange: idx === revealedCount ? "transform" : "auto",
                      boxShadow: isWinner
                        ? `0 0 40px ${color.glow},0 0 80px ${color.glow},0 8px 32px rgba(0,0,0,0.6)`
                        : revealed
                          ? `0 0 20px ${color.glow},0 6px 24px rgba(0,0,0,0.6)`
                          : "0 4px 16px rgba(0,0,0,0.6)",
                      transition: "box-shadow 0.5s ease",
                    }}>
                      {/* フリップコンテナ */}
                      <div style={{
                        position: "relative",
                        height: "clamp(160px,calc(100vh - 260px),460px)",
                        transformStyle: "preserve-3d",
                        transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
                        transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
                        willChange: "transform",
                      }}>

                        {/* 表面（発表前）: backface-visibility:hidden で裏返し時は非表示 */}
                        <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden" }}>
                          <UnrevealedPanel name={vote.judgeName} idx={idx} />
                        </div>

                        {/* 裏面（発表後）: 最初から 180deg 回転して配置 */}
                        <div style={{
                          position:"absolute", inset:0,
                          backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden",
                          transform:"rotateY(180deg)",
                        }}>
                          <div style={{ position:"relative", width:"100%", display:"flex", flexDirection:"column", height:"clamp(160px,calc(100vh - 260px),460px)" }}>
                            {/* 左柱 */}
                            <div style={{ position:"absolute", top:0, bottom:0, left:0, width:"12%", background:"linear-gradient(to right,#5a3800,#c8900a,#ffe066,#c8900a,#5a3800)" }}>
                              {[0.25,0.5,0.75].map((p) => (
                                <div key={p} style={{ position:"absolute", width:"100%", display:"flex", justifyContent:"center", top:`${p*100}%`, transform:"translateY(-50%)" }}>
                                  <div style={{ width:"12px", height:"12px", borderRadius:"50%", background:"radial-gradient(circle,#ffe066,#7a5200)", border:"1px solid #5a3800" }} />
                                </div>
                              ))}
                            </div>
                            {/* 右柱 */}
                            <div style={{ position:"absolute", top:0, bottom:0, right:0, width:"12%", background:"linear-gradient(to left,#5a3800,#c8900a,#ffe066,#c8900a,#5a3800)" }}>
                              {[0.25,0.5,0.75].map((p) => (
                                <div key={p} style={{ position:"absolute", width:"100%", display:"flex", justifyContent:"center", top:`${p*100}%`, transform:"translateY(-50%)" }}>
                                  <div style={{ width:"12px", height:"12px", borderRadius:"50%", background:"radial-gradient(circle,#ffe066,#7a5200)", border:"1px solid #5a3800" }} />
                                </div>
                              ))}
                            </div>
                            {/* 中央カラーエリア */}
                            <div style={{ position:"absolute", left:"11%", right:"11%", top:0, bottom:0, display:"flex", flexDirection:"column" }}>
                              <div style={{ height:"10px", background:"linear-gradient(180deg,#c8900a,#7a5200)", borderBottom:"1px solid #ffe066" }} />
                              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"12px 0", background:color.bg, position:"relative" }}>
                                <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"linear-gradient(170deg,rgba(255,255,255,0.18) 0%,transparent 50%)" }} />
                                <p style={{
                                  fontWeight:900, color:"#fff", lineHeight:1.4, position:"relative", zIndex:1,
                                  writingMode:"vertical-rl", textOrientation:"mixed",
                                  fontSize:"clamp(15px,2.2vw,26px)", letterSpacing:"0.08em",
                                  textShadow:"0 2px 8px rgba(0,0,0,0.6),0 0 20px rgba(255,255,255,0.4)",
                                  whiteSpace:"pre-wrap",
                                }}>
                                  {candidate?.productNumber}
                                </p>
                              </div>
                              <div style={{ height:"10px", background:"linear-gradient(0deg,#c8900a,#7a5200)", borderTop:"1px solid #ffe066" }} />
                            </div>
                          </div>
                        </div>

                      </div>{/* /フリップコンテナ */}
                    </div>{/* /perspective ラッパー */}

                    {/* 台座 */}
                    <div className="w-full"
                      style={{
                        height:"clamp(12px,1.8vw,20px)",
                        background:"linear-gradient(180deg,#7a5200,#4a3000)",
                        borderTop:"2px solid #c8900a",
                        borderRadius:"0 0 4px 4px",
                        boxShadow:"0 4px 8px rgba(0,0,0,0.5)",
                      }} />

                    {/* 名前ラベル（台座下） */}
                    <p className="mt-1 text-center font-semibold truncate w-full"
                      style={{
                        fontSize:"clamp(24px,3vw,33px)",
                        color: revealed ? color.border : "#666",
                        maxWidth:"100%",
                      }}>
                      {vote.judgeName}
                    </p>

                    {/* スペーサー（高さ維持） */}
                    <div style={{ height:"22px" }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右下固定：操作ボタン */}
          <div className="fixed bottom-6 right-8 z-20 flex flex-col items-end gap-2">
            {phase==="revealing"&&revealedCount<orderedVotes.length&&(
              <button onClick={handleRevealNext} disabled={animating}
                className={`font-normal rounded-lg transition-all ${animating?"opacity-50 cursor-not-allowed":"hover:opacity-80 active:scale-95"}`}
                style={{
                  background: "rgba(60,60,60,0.6)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: animating ? "#6b7280" : "#9ca3af",
                  fontSize: "clamp(11px,1vw,14px)",
                  padding: "8px 20px",
                  letterSpacing: "0.05em",
                }}>
                {animating ? "発表中..." : `次の審査員を発表　${revealedCount+1} / ${orderedVotes.length}`}
              </button>
            )}
            {phase==="finished"&&(
              <a href="/judge" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
                ← 審査員投票ページへ
              </a>
            )}
            <button onClick={handleReset} className="text-gray-700 hover:text-gray-500 text-xs transition-colors">
              ↩ 最初からやり直す
            </button>
            <a
              href="/judge/winner"
              className="text-gray-800 hover:text-gray-600 text-xs transition-colors"
              style={{ fontSize: "10px", letterSpacing: "0.05em" }}
            >
              優勝表示
            </a>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInText {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes bounceIn {
          0%   { transform:scale(0) rotate(-20deg); opacity:0; }
          60%  { transform:scale(1.5) rotate(5deg); }
          100% { transform:scale(1) rotate(0); opacity:1; }
        }
        @keyframes twinkle {
          from { opacity:0.05; }
          to   { opacity:0.35; }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity:1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity:0.3; }
        }
        @keyframes winnerPop {
          0%   { opacity:0; transform: scale(0.3) rotate(-5deg); }
          70%  { transform: scale(1.08) rotate(1deg); }
          100% { opacity:1; transform: scale(1) rotate(0deg); }
        }
        @keyframes textGlow {
          from { text-shadow: 0 0 60px rgba(255,220,50,1), 0 0 120px rgba(255,150,0,0.8), 0 4px 12px rgba(0,0,0,0.9); }
          to   { text-shadow: 0 0 100px rgba(255,255,100,1), 0 0 200px rgba(255,200,0,1), 0 4px 12px rgba(0,0,0,0.9); }
        }
      `}</style>
    </main>
  );
}
