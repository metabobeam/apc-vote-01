"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── サウンド定義（両方ともループ） ────────────────────────────────────────────
const DASH_SOUNDS = [
  { id: "bgm",       src: "/sp-among-terraced-houses.mp3", label: "BGM", loop: true },
  { id: "stopwatch", src: "/sp-stopwatch.wav",              label: "SW",  loop: true },
] as const;

// ── 型定義 ──────────────────────────────────────────────────────────────────
interface GroupStat { group: string; voted: number; total: number; }

interface DashboardData {
  title: string;
  deadline: string;
  overall: { voted: number; total: number };
  groups: GroupStat[];
  lastUpdated: string;
}

// ── 定数 ────────────────────────────────────────────────────────────────────
const REFRESH_SEC = 7;
const R = 38;
const C = 2 * Math.PI * R;

// ── シルバーメタル パレット ────────────────────────────────────────────────
const M = {
  // 背景
  bg:          "#0b0d12",
  bgRadial:    "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(160,175,210,0.07) 0%, transparent 65%)",
  gridLine:    "rgba(180,195,225,0.065)",
  // カード
  cardBg:      "linear-gradient(160deg, #252a3a 0%, #1a1d28 45%, #13151e 100%)",
  cardBorder:  "rgba(200,215,240,0.16)",
  cardGlow:    "0 0 30px rgba(150,168,210,0.10), 0 4px 16px rgba(0,0,0,0.65)",
  cardHighlight:"linear-gradient(90deg, transparent 0%, rgba(210,225,255,0.12) 50%, transparent 100%)",
  panelBg:     "linear-gradient(155deg, #2a2f42 0%, #1e2232 50%, #141720 100%)",
  // テキスト
  silver:      "#dce4f4",
  silverDim:   "rgba(200,215,240,0.60)",
  silverFaint: "rgba(175,190,220,0.35)",
  // アクセント
  accent:      "#60a5fa",
  accentGlow:  "0 0 16px rgba(96,165,250,0.55)",
  accentDim:   "rgba(96,165,250,0.12)",
  green:       "#34d399",
  greenGlow:   "0 0 16px rgba(52,211,153,0.55)",
  red:         "#f87171",
  redGlow:     "0 0 16px rgba(248,113,113,0.55)",
  // デコ
  shimmer:     "linear-gradient(90deg, transparent 0%, rgba(210,225,255,0.10) 50%, transparent 100%)",
  headerBg:    "linear-gradient(180deg, rgba(28,32,48,0.98) 0%, rgba(16,18,26,0.95) 100%)",
  topLine:     "linear-gradient(90deg, transparent 0%, rgba(160,180,230,0.6) 30%, rgba(200,220,255,0.9) 50%, rgba(160,180,230,0.6) 70%, transparent 100%)",
};

// ── 残り時間計算 ──────────────────────────────────────────────────────────
function calcTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    hours:   Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    urgent:  diff < 600000,
  };
}

// ── 7セグ ユニット（ダーク版） ────────────────────────────────────────────
function DarkSevenSeg({ value, label, urgent }: { value: string; label: string; urgent: boolean }) {
  const litColor  = urgent ? "rgba(248,113,113,0.55)"  : "rgba(160,175,215,0.22)";
  const dimColor  = urgent ? "rgba(248,113,113,0.06)"  : "rgba(160,175,215,0.035)";
  const glowColor = urgent ? "rgba(248,113,113,0.30)"  : "rgba(140,160,210,0.14)";
  const bgColor   = urgent ? "rgba(40,8,8,0.55)"       : "rgba(8,10,16,0.55)";
  const border    = urgent ? "rgba(248,113,113,0.25)"  : "rgba(140,160,210,0.10)";
  const fontSize  = "clamp(52px, 7vw, 72px)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        background: bgColor, border: `1px solid ${border}`,
        borderRadius: "12px", padding: "6px 14px",
        boxShadow: `0 0 18px ${glowColor}, inset 0 0 10px rgba(0,0,0,0.5)`,
        position: "relative",
      }}>
        {/* 消灯セグメント */}
        <span style={{
          fontFamily: "'DSEG7Classic', monospace", fontWeight: "bold",
          fontSize, color: dimColor, letterSpacing: "0.05em",
          display: "block", lineHeight: 1, userSelect: "none",
        }}>88</span>
        {/* 点灯セグメント */}
        <span style={{
          fontFamily: "'DSEG7Classic', monospace", fontWeight: "bold",
          fontSize, color: litColor, letterSpacing: "0.05em",
          display: "block", lineHeight: 1,
          position: "absolute", top: "6px", left: "14px",
          textShadow: `0 0 10px ${litColor}, 0 0 24px ${glowColor}`,
        }}>{value}</span>
      </div>
      <span style={{ fontSize: "11px", color: M.silverFaint, marginTop: "5px", letterSpacing: "0.06em" }}>
        {label}
      </span>
    </div>
  );
}

// ── SVG ドーナツ円グラフ ──────────────────────────────────────────────────
function DonutChart({
  voted, total, size = 130, state = "normal",
}: {
  voted: number; total: number; size?: number; state?: "normal" | "urgent" | "complete";
}) {
  const pct      = total > 0 ? Math.min(voted / total, 1) : 0;
  const votedLen = pct * C;
  const arcColor = state === "complete" ? M.green : state === "urgent" ? M.red : M.accent;
  const glowPx   = state === "complete" ? "#34d399" : state === "urgent" ? "#f87171" : "#60a5fa";
  const labelPct = total > 0 ? `${Math.round(pct * 100)}%` : "—";

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block", filter: pct > 0 ? `drop-shadow(0 0 6px ${glowPx})` : "none" }}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(50,58,78,0.8)" strokeWidth="11" />
      {pct > 0 && (
        <circle cx="50" cy="50" r={R} fill="none"
          stroke={arcColor} strokeWidth="11"
          strokeDasharray={`${votedLen} ${C}`} strokeDashoffset="0"
          transform="rotate(-90 50 50)" strokeLinecap="butt"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      )}
      <text x="50" y="47" textAnchor="middle" fill={arcColor} fontSize="16" fontWeight="bold">
        {labelPct}
      </text>
      <text x="50" y="61" textAnchor="middle" fill="rgba(180,195,225,0.55)" fontSize="9">
        {voted} / {total > 0 ? total : "?"}
      </text>
    </svg>
  );
}

// ── グループカード ───────────────────────────────────────────────────────────
function GroupCard({ stat }: { stat: GroupStat }) {
  const pct   = stat.total > 0 ? stat.voted / stat.total : null;
  const state: "normal" | "urgent" | "complete" =
    pct === null ? "normal" : pct >= 1 ? "complete" : pct < 0.5 ? "urgent" : "normal";
  const barColor = state === "complete" ? M.green : state === "urgent" ? M.red : M.accent;
  const barPct   = pct !== null ? Math.round(pct * 100) : null;

  return (
    <div style={{
      background: M.cardBg, border: `1px solid ${M.cardBorder}`,
      borderRadius: "14px", padding: "14px 10px 10px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
      boxShadow: M.cardGlow, minWidth: 0, position: "relative", overflow: "hidden",
    }}>
      {/* 上部ハイライトライン */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: M.cardHighlight }} />
      {/* 斜めハイライト */}
      <div style={{ position: "absolute", top: 0, left: "-50%", right: "-50%", height: "40%", background: "linear-gradient(180deg, rgba(200,215,255,0.025) 0%, transparent 100%)", pointerEvents: "none" }} />
      <DonutChart voted={stat.voted} total={stat.total} size={104} state={state} />
      {barPct !== null && (
        <div style={{ width: "80%", height: "3px", background: "rgba(40,48,68,0.9)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ width: `${barPct}%`, height: "100%", background: barColor, borderRadius: "2px", transition: "width 0.8s ease", boxShadow: `0 0 6px ${barColor}` }} />
        </div>
      )}
      <p style={{
        fontSize: "10px", fontWeight: 600, color: M.silver,
        textAlign: "center", lineHeight: 1.35,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
      }}>
        {stat.group}
      </p>
      {stat.total > 0 && (
        <p style={{ fontSize: "9px", color: M.silverFaint }}>
          未 {Math.max(0, stat.total - stat.voted)} 人
        </p>
      )}
    </div>
  );
}

// ── ライブフィード アイテム ────────────────────────────────────────────────
interface FeedItem {
  id:    string;
  group: string;
  emp:   string;   // マスク済み社員番号
  time:  string;
}

// ── メイン ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [data,       setData]       = useState<DashboardData | null>(null);
  const [countdown,  setCountdown]  = useState(REFRESH_SEC);
  const [loading,    setLoading]    = useState(true);
  const [tick,       setTick]       = useState(0);
  const [audioReady, setAudioReady] = useState(false); // オートプレイ解放済み
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRefs  = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  // ライブフィード
  const [feedItems,   setFeedItems]   = useState<FeedItem[]>([]);
  const feedQueueRef  = useRef<FeedItem[]>([]);
  const seenIdsRef    = useRef<Set<string>>(new Set());
  const dripTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstFetch  = useRef(true);

  // ── サウンド初期化 & 自動再生 ─────────────────────────────────────────────
  useEffect(() => {
    DASH_SOUNDS.forEach(({ id, src, loop }) => {
      const a = new Audio(src);
      a.preload = "auto";
      a.loop    = loop;
      a.volume  = 0.85;
      audioRefs.current.set(id, a);
    });

    const startAll = () => {
      let started = false;
      audioRefs.current.forEach((a, id) => {
        a.currentTime = 0;
        a.play().then(() => {
          setPlaying((p) => new Set(p).add(id));
          started = true;
        }).catch(() => {});
      });
      if (started) setAudioReady(true);
    };

    // 500ms 後に自動再生を試みる
    const tryTimer = setTimeout(() => {
      audioRefs.current.forEach((a, id) => {
        a.currentTime = 0;
        a.play().then(() => {
          setPlaying((p) => new Set(p).add(id));
          setAudioReady(true);
        }).catch(() => {
          // ブラウザがブロック → 最初のクリックで解放
          document.addEventListener("click", startAll, { once: true });
        });
      });
    }, 500);

    return () => {
      clearTimeout(tryTimer);
      document.removeEventListener("click", startAll);
      audioRefs.current.forEach((a) => { a.pause(); a.src = ""; });
    };
  }, []);

  const toggleSound = (id: string) => {
    const a = audioRefs.current.get(id);
    if (!a) return;
    if (playing.has(id)) {
      a.pause(); a.currentTime = 0;
      setPlaying((p) => { const n = new Set(p); n.delete(id); return n; });
    } else {
      a.currentTime = 0;
      a.play().catch(() => {});
      setPlaying((p) => new Set(p).add(id));
      setAudioReady(true);
    }
  };

  // ── データ取得 ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [cfgRes, statsRes, votesRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/results"),
        fetch("/api/admin/votes"),
      ]);
      const cfg   = await cfgRes.json();
      const stats = await statsRes.json();

      // ── ライブフィード更新 ──
      const votesData = await votesRes.json();
      const allVotes: { id: string; employeeNumber: string; groupName: string; timestamp: string }[] =
        (votesData.votes ?? []).sort(
          (a: { timestamp: string }, b: { timestamp: string }) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      const newItems: FeedItem[] = [];
      for (const v of allVotes) {
        if (!seenIdsRef.current.has(v.id)) {
          seenIdsRef.current.add(v.id);
          const emp = v.employeeNumber;
          const masked = emp.length > 4
            ? "*".repeat(emp.length - 4) + emp.slice(-4)
            : "*".repeat(emp.length);
          newItems.push({
            id:    v.id,
            group: v.groupName || "未設定",
            emp:   masked,
            time:  new Date(v.timestamp).toLocaleTimeString("ja-JP", {
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            }),
          });
        }
      }

      if (isFirstFetch.current) {
        // 初回: 最新30件を最初から流す（全部キューに）
        isFirstFetch.current = false;
        feedQueueRef.current.push(...newItems.slice(-30));
      } else {
        // 2回目以降: 差分のみキューへ
        feedQueueRef.current.push(...newItems);
      }
      const participants: Record<string, number> = cfg.groupParticipants ?? {};
      const voterMap: Record<string, number>     = {};
      for (const { group, count } of (stats.votersByGroup ?? [])) voterMap[group] = count;

      const groups: GroupStat[] = (cfg.groups ?? []).map((g: string) => ({
        group: g, voted: voterMap[g] ?? 0, total: participants[g] ?? 0,
      }));
      for (const { group, count } of (stats.votersByGroup ?? [])) {
        if (!(cfg.groups ?? []).includes(group)) groups.push({ group, voted: count, total: 0 });
      }
      const totalParticipants = Object.values(participants as Record<string, number>)
        .reduce((a: number, b: number) => a + b, 0);

      setData({
        title: cfg.title ?? "社員投票",
        deadline: cfg.deadline ?? "",
        overall: { voted: stats.voterCount ?? 0, total: totalParticipants },
        groups,
        lastUpdated: new Date().toLocaleTimeString("ja-JP"),
      });
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current  = setInterval(() => { fetchData(); setCountdown(REFRESH_SEC); }, REFRESH_SEC * 1000);
    cdRef.current     = setInterval(() => setCountdown((v) => (v <= 1 ? REFRESH_SEC : v - 1)), 1000);
    tickRef.current   = setInterval(() => setTick((t) => t + 1), 1000);
    // ドリップタイマー: 750ms ごとにキューから1件ずつ表示
    dripTimerRef.current = setInterval(() => {
      if (feedQueueRef.current.length > 0) {
        const item = feedQueueRef.current.shift()!;
        setFeedItems((prev) => [item, ...prev].slice(0, 35));
      }
    }, 750);
    return () => {
      if (timerRef.current)  clearInterval(timerRef.current);
      if (cdRef.current)     clearInterval(cdRef.current);
      if (tickRef.current)   clearInterval(tickRef.current);
      if (dripTimerRef.current) clearInterval(dripTimerRef.current);
    };
  }, [fetchData]);

  void tick;
  const timeLeft    = data?.deadline ? calcTimeLeft(data.deadline) : null;
  const deadlineStr = data?.deadline
    ? new Date(data.deadline).toLocaleString("ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
      })
    : "";
  const overallPct = data?.overall.total ? Math.round((data.overall.voted / data.overall.total) * 100) : null;
  const overallState: "normal" | "urgent" | "complete" =
    overallPct === null ? "normal" : overallPct >= 100 ? "complete" : overallPct < 50 ? "urgent" : "normal";

  return (
    <main style={{
      minHeight: "100vh",
      background: M.bg,
      backgroundImage: `
        ${M.bgRadial},
        linear-gradient(${M.gridLine} 1px, transparent 1px),
        linear-gradient(90deg, ${M.gridLine} 1px, transparent 1px)
      `,
      backgroundSize: "100% 100%, 44px 44px, 44px 44px",
      display: "flex", flexDirection: "column",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
    }}>

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <header style={{
        background: M.headerBg,
        borderBottom: `1px solid ${M.cardBorder}`,
        padding: "0 28px",
        minHeight: "110px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 24px rgba(0,0,0,0.7), 0 1px 0 rgba(200,215,255,0.08)",
        backdropFilter: "blur(12px)",
        flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
        borderTop: "1px solid rgba(160,180,230,0.22)",
      }}>
        {/* 左 */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => router.push("/kanri")}
            style={{
              fontSize: "11px", color: M.silverFaint,
              background: "rgba(180,195,230,0.06)", border: `1px solid rgba(180,195,230,0.12)`,
              borderRadius: "8px", padding: "5px 12px", cursor: "pointer",
              letterSpacing: "0.03em", transition: "all 0.2s",
            }}>
            ← 管理画面
          </button>
          <div style={{ width: "1px", height: "22px", background: "rgba(180,195,230,0.15)" }} />
          <h1 style={{ fontSize: "14px", fontWeight: 700, color: M.silver, letterSpacing: "0.08em" }}>
            📊 投票 ダッシュボード
          </h1>
        </div>

        {/* 中央: 残り時間（7セグ大型表示）*/}
        {data && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            {/* 締め切り日時（小さめ） */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "8px", letterSpacing: "0.14em", color: M.silverFaint, textTransform: "uppercase" }}>
                締め切り
              </span>
              <span style={{
                fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em",
                background: "linear-gradient(135deg, #d0d8f0 0%, #8898b8 50%, #c0c8e0 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                {deadlineStr}
              </span>
            </div>
            {/* 7セグ カウントダウン */}
            {timeLeft ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                {timeLeft.hours > 0 && (
                  <DarkSevenSeg value={String(timeLeft.hours).padStart(2, "0")} label="時間" urgent={timeLeft.urgent} />
                )}
                <DarkSevenSeg value={String(timeLeft.minutes).padStart(2, "0")} label="分" urgent={timeLeft.urgent} />
                <DarkSevenSeg value={String(timeLeft.seconds).padStart(2, "0")} label="秒" urgent={timeLeft.urgent} />
              </div>
            ) : (
              <div style={{ fontSize: "13px", fontWeight: 700, color: M.silverFaint, letterSpacing: "0.1em" }}>
                締め切り済み
              </div>
            )}
          </div>
        )}

        {/* 右 */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* オートプレイ解放前のヒント */}
          {!audioReady && (
            <span style={{
              fontSize: "9px", color: "rgba(96,165,250,0.4)",
              border: "1px solid rgba(96,165,250,0.15)",
              borderRadius: "6px", padding: "3px 8px",
              animation: "softPulse 2s ease-in-out infinite",
            }}>
              ♪ クリックで音楽開始
            </span>
          )}
          {data && <span style={{ fontSize: "9px", color: M.silverFaint }}>更新 {data.lastUpdated}</span>}
          {/* 更新カウンタ */}
          <div style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: M.accentDim, border: "1px solid rgba(96,165,250,0.22)",
            borderRadius: "8px", padding: "4px 12px",
          }}>
            <span style={{ fontSize: "9px", color: M.silverFaint }}>次の更新</span>
            <span style={{ fontSize: "17px", fontWeight: 800, color: M.accent, minWidth: "18px", textAlign: "center", textShadow: M.accentGlow }}>
              {countdown}
            </span>
            <span style={{ fontSize: "9px", color: M.silverFaint }}>秒</span>
          </div>
          <button onClick={() => { fetchData(); setCountdown(REFRESH_SEC); }}
            style={{
              fontSize: "10px", color: M.silverFaint,
              background: "rgba(180,195,230,0.06)", border: `1px solid rgba(180,195,230,0.12)`,
              borderRadius: "8px", padding: "5px 12px", cursor: "pointer",
            }}>
            今すぐ更新
          </button>
          {/* サウンドボタン（極力目立たない） */}
          <div style={{ display: "flex", gap: "3px" }}>
            {DASH_SOUNDS.map(({ id, label }) => {
              const on = playing.has(id);
              return (
                <button key={id} onClick={() => toggleSound(id)}
                  title={id === "bgm" ? "BGM" : "ストップウォッチ"}
                  style={{
                    fontSize: "9px",
                    color: on ? "rgba(96,165,250,0.7)" : "rgba(140,155,185,0.28)",
                    background: on ? "rgba(96,165,250,0.07)" : "transparent",
                    border: `1px solid ${on ? "rgba(96,165,250,0.2)" : "rgba(140,155,185,0.12)"}`,
                    borderRadius: "6px", padding: "3px 7px",
                    cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.04em",
                  }}>
                  {on ? "■" : "▶"} {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, padding: "18px 24px", maxWidth: "1600px", width: "100%", margin: "0 auto", boxSizing: "border-box" as const }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
            <div style={{ width: "40px", height: "40px", border: `3px solid rgba(180,195,230,0.15)`, borderTop: `3px solid ${M.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : data ? (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 260px", gap: "16px", alignItems: "start" }}>

            {/* ── 左: 全体 ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* 全体カード */}
              <div style={{
                background: M.panelBg, border: `1px solid ${M.cardBorder}`,
                borderRadius: "18px", padding: "20px 16px",
                boxShadow: M.cardGlow,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: M.topLine }} />
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "linear-gradient(180deg, rgba(200,215,255,0.028) 0%, transparent 100%)", pointerEvents: "none" }} />
                {/* shimmer sweep */}
                <div style={{
                  position: "absolute", top: 0, bottom: 0, width: "60%",
                  background: "linear-gradient(90deg, transparent, rgba(200,220,255,0.04), transparent)",
                  animation: "shimmerSweep 4s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
                <p style={{ fontSize: "9px", fontWeight: 700, color: M.silverFaint, letterSpacing: "0.14em", marginBottom: "14px", position: "relative" }}>
                  ▌ 全体の投票状況
                </p>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", position: "relative" }}>
                  <DonutChart voted={data.overall.voted} total={data.overall.total} size={148} state={overallState} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", position: "relative" }}>
                  {/* 投票済み */}
                  <div style={{
                    background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.16)",
                    borderRadius: "10px", padding: "10px 10px", textAlign: "center",
                  }}>
                    <p style={{ fontSize: "8px", color: M.silverFaint, marginBottom: "4px", letterSpacing: "0.08em" }}>投票済み</p>
                    <p style={{ fontSize: "28px", fontWeight: 800, color: M.accent, lineHeight: 1, textShadow: M.accentGlow }}>
                      {data.overall.voted}
                    </p>
                    <p style={{ fontSize: "8px", color: M.silverFaint, marginTop: "3px" }}>人</p>
                  </div>
                  {data.overall.total > 0 ? (
                    <div style={{
                      background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.16)",
                      borderRadius: "10px", padding: "10px 10px", textAlign: "center",
                    }}>
                      <p style={{ fontSize: "8px", color: M.silverFaint, marginBottom: "4px", letterSpacing: "0.08em" }}>未投票</p>
                      <p style={{ fontSize: "28px", fontWeight: 800, color: M.red, lineHeight: 1, textShadow: M.redGlow }}>
                        {Math.max(0, data.overall.total - data.overall.voted)}
                      </p>
                      <p style={{ fontSize: "8px", color: M.silverFaint, marginTop: "3px" }}>人</p>
                    </div>
                  ) : (
                    <div style={{
                      background: "rgba(180,195,230,0.04)", border: `1px solid ${M.cardBorder}`,
                      borderRadius: "10px", padding: "10px", textAlign: "center",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <p style={{ fontSize: "9px", color: M.silverFaint, lineHeight: 1.5 }}>参加人数<br/>未設定</p>
                    </div>
                  )}
                </div>
                {data.overall.total > 0 && (
                  <div style={{ marginTop: "12px", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "9px", color: M.silverFaint }}>参加 {data.overall.total} 人</span>
                      {overallPct !== null && (
                        <span style={{ fontSize: "9px", fontWeight: 700, color: overallState === "complete" ? M.green : overallState === "urgent" ? M.red : M.accent }}>
                          {overallPct}%
                        </span>
                      )}
                    </div>
                    <div style={{ height: "5px", background: "rgba(30,38,58,0.9)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{
                        width: `${overallPct ?? 0}%`, height: "100%",
                        background: `linear-gradient(90deg, ${overallState === "complete" ? M.green : overallState === "urgent" ? M.red : M.accent}, ${overallState === "complete" ? "#6ee7b7" : overallState === "urgent" ? "#fca5a5" : "#93c5fd"})`,
                        borderRadius: "3px", transition: "width 0.8s ease",
                        boxShadow: overallState === "complete" ? M.greenGlow : overallState === "urgent" ? M.redGlow : M.accentGlow,
                      }} />
                    </div>
                  </div>
                )}
              </div>

              {/* 凡例カード */}
              <div style={{
                background: M.cardBg, border: `1px solid ${M.cardBorder}`,
                borderRadius: "12px", padding: "12px 14px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: M.cardHighlight }} />
                <p style={{ fontSize: "8px", color: M.silverFaint, letterSpacing: "0.12em", marginBottom: "9px" }}>凡例</p>
                {[
                  { color: M.accent, label: "投票進行中" },
                  { color: M.green,  label: "投票完了 (100%)" },
                  { color: M.red,    label: "投票率 50% 未満" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: color, boxShadow: `0 0 7px ${color}`, flexShrink: 0 }} />
                    <span style={{ fontSize: "10px", color: M.silverDim }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 右: 班別 ── */}
            <div>
              {data.groups.filter((s) => s.total > 0).length > 0 ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: M.silverFaint, letterSpacing: "0.14em" }}>▌ 班別 投票状況</span>
                    <span style={{ fontSize: "9px", color: M.silverFaint }}>{data.groups.filter((s) => s.total > 0).length} 班</span>
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
                    gap: "11px",
                  }}>
                    {data.groups.filter((s) => s.total > 0).map((s) => <GroupCard key={s.group} stat={s} />)}
                  </div>
                </>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: "300px", background: M.panelBg,
                  border: `1px solid ${M.cardBorder}`, borderRadius: "18px",
                  color: M.silverFaint, fontSize: "13px",
                }}>
                  組が登録されていません
                </div>
              )}
            </div>

            {/* ── 右パネル: ライブフィード ── */}
            <div style={{
              background: M.panelBg, border: `1px solid ${M.cardBorder}`,
              borderRadius: "18px", overflow: "hidden",
              boxShadow: M.cardGlow, position: "relative",
              display: "flex", flexDirection: "column",
              maxHeight: "calc(100vh - 160px)",
            }}>
              {/* shimmer top line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: M.topLine }} />
              {/* ヘッダー */}
              <div style={{
                padding: "12px 14px 10px", borderBottom: `1px solid ${M.cardBorder}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: "#34d399",
                    boxShadow: "0 0 8px #34d399",
                    animation: "livePulse 1.4s ease-in-out infinite",
                    display: "inline-block", flexShrink: 0,
                  }} />
                  <span style={{ fontSize: "10px", fontWeight: 700, color: M.silver, letterSpacing: "0.12em" }}>
                    LIVE 投票ログ
                  </span>
                </div>
                <span style={{ fontSize: "9px", color: M.silverFaint }}>
                  {feedItems.length} 件
                </span>
              </div>
              {/* フィードリスト */}
              <div style={{
                flex: 1, overflowY: "auto", overflowX: "hidden",
                padding: "6px 0",
                scrollbarWidth: "none",
              }}>
                {feedItems.length === 0 ? (
                  <div style={{ padding: "24px 14px", textAlign: "center", color: M.silverFaint, fontSize: "11px" }}>
                    投票待機中...
                  </div>
                ) : (
                  feedItems.map((item, i) => (
                    <div key={item.id} style={{
                      padding: "7px 14px",
                      borderBottom: `1px solid rgba(180,195,230,0.05)`,
                      display: "flex", alignItems: "center", gap: "8px",
                      animation: i === 0 ? "feedSlideIn 0.4s ease-out" : "none",
                      background: i === 0 ? "rgba(52,211,153,0.04)" : "transparent",
                      transition: "background 1s",
                    }}>
                      {/* チェックアイコン */}
                      <span style={{
                        fontSize: "9px", color: "#34d399",
                        textShadow: "0 0 6px #34d399", flexShrink: 0,
                      }}>✓</span>
                      {/* 内容 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: "11px", fontWeight: 600, color: M.silver,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.group}
                        </div>
                        <div style={{ fontSize: "10px", color: M.silverFaint, letterSpacing: "0.04em" }}>
                          {item.emp}
                        </div>
                      </div>
                      {/* 時刻 */}
                      <span style={{ fontSize: "8px", color: "rgba(160,175,210,0.28)", flexShrink: 0, letterSpacing: "0.03em" }}>
                        {item.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes spin         { to { transform: rotate(360deg); } }
        @keyframes shimmerSweep { 0%,100% { left: -60%; } 60% { left: 120%; } }
        @keyframes urgentBlink  { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes softPulse    { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes livePulse    { 0%,100% { opacity: 1; box-shadow: 0 0 8px #34d399; } 50% { opacity: 0.5; box-shadow: 0 0 3px #34d399; } }
        @keyframes feedSlideIn  { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        /* スクロールバー非表示 */
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
