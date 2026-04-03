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

// ── 組名を ">" まで切り詰め ───────────────────────────────────────────────
function trimGroupName(name: string): string {
  const idx = name.search(/[>＞]/);
  return idx === -1 ? name : name.slice(0, idx + 1);
}

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
  const litColor  = urgent ? "rgba(255,130,130,0.92)"  : "rgba(175,210,255,0.80)";
  const dimColor  = urgent ? "rgba(248,113,113,0.10)"  : "rgba(160,195,240,0.08)";
  const glowColor = urgent ? "rgba(255,80,80,0.50)"    : "rgba(120,175,255,0.30)";
  const bgColor   = urgent ? "rgba(40,8,8,0.70)"       : "rgba(8,12,22,0.70)";
  const border    = urgent ? "rgba(255,100,100,0.40)"  : "rgba(120,165,240,0.22)";
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
      <text x="50" y="61" textAnchor="middle" fill="rgba(255,255,255,0.90)" fontSize="9">
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
      borderRadius: "24px", padding: "24px 17px 17px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
      boxShadow: M.cardGlow, minWidth: 0, position: "relative", overflow: "hidden",
    }}>
      {/* 上部ハイライトライン */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: M.cardHighlight }} />
      {/* 斜めハイライト */}
      <div style={{ position: "absolute", top: 0, left: "-50%", right: "-50%", height: "40%", background: "linear-gradient(180deg, rgba(200,215,255,0.025) 0%, transparent 100%)", pointerEvents: "none" }} />
      <DonutChart voted={stat.voted} total={stat.total} size={177} state={state} />
      {barPct !== null && (
        <div style={{ width: "80%", height: "5px", background: "rgba(40,48,68,0.9)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ width: `${barPct}%`, height: "100%", background: barColor, borderRadius: "3px", transition: "width 0.8s ease", boxShadow: `0 0 8px ${barColor}` }} />
        </div>
      )}
      <p style={{
        fontSize: "26px", fontWeight: 700, color: M.silver,
        textAlign: "center", lineHeight: 1.3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        width: "100%",
      }}>
        {trimGroupName(stat.group)}
      </p>
      {stat.total > 0 && (
        <p style={{ fontSize: "15px", color: "#ffffff", fontWeight: 600 }}>
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
  emp:   string;
  time:  string;
}

// ── メイン ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [data,       setData]       = useState<DashboardData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [countdown,  setCountdown]  = useState(REFRESH_SEC);
  const [loading,    setLoading]    = useState(true);
  const [tick,       setTick]       = useState(0);
  // (audioReady は使わない: 手動再生のみ)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRefs  = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  // ライブフィード
  const [feedItems,   setFeedItems]   = useState<FeedItem[]>([]);
  const feedQueueRef  = useRef<FeedItem[]>([]);
  const seenIdsRef    = useRef<Set<string>>(new Set());
  const dripTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstFetch    = useRef(true);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  // ── サウンド初期化（プリロードのみ・自動再生なし） ──────────────────────
  useEffect(() => {
    DASH_SOUNDS.forEach(({ id, src, loop }) => {
      const a = new Audio(src);
      a.preload = "auto";
      a.loop    = loop;
      a.volume  = 0.85;
      audioRefs.current.set(id, a);
    });
    return () => {
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
    }
  };

  // ── タイムアウト付きfetch ────────────────────────────────────────────────
  const fetchWithTimeout = (url: string, ms = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
  };

  // ── データ取得 ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      // 統計・設定は必須（失敗したらエラー表示）
      const [cfgRes, statsRes] = await Promise.all([
        fetchWithTimeout("/api/config"),
        fetchWithTimeout("/api/results"),
      ]);
      if (!cfgRes.ok || !statsRes.ok) throw new Error("API error");
      const cfg   = await cfgRes.json();
      const stats = await statsRes.json();
      setFetchError(null);

      // ── ライブフィード更新（/api/results の recentVotes を使用 → 403不要） ──
      const allVotes: { id: string; employeeNumber: string; groupName: string; timestamp: string }[] =
        ((stats.recentVotes ?? []) as { id: string; employeeNumber: string; groupName: string; timestamp: string }[])
          .slice()
          .sort((a: { timestamp: string }, b: { timestamp: string }) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

      const newItems: FeedItem[] = [];
      for (const v of allVotes) {
        if (!seenIdsRef.current.has(v.id)) {
          seenIdsRef.current.add(v.id);
          newItems.push({
            id:    v.id,
            group: v.groupName || "未設定",
            emp:   v.employeeNumber,
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
      // cfg.groups に現在登録されている組のみ集計（削除済み組の古いエントリを除外）
      const totalParticipants = (cfg.groups ?? [] as string[])
        .reduce((a: number, g: string) => a + (participants[g] ?? 0), 0);

      setData({
        title: cfg.title ?? "社員投票",
        deadline: cfg.deadline ?? "",
        overall: { voted: stats.voterCount ?? 0, total: totalParticipants },
        groups,
        lastUpdated: new Date().toLocaleTimeString("ja-JP"),
      });
    } catch (e) {
      setFetchError(e instanceof Error && e.name === "AbortError" ? "タイムアウト（回線が遅い可能性）" : "データ取得に失敗しました");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current  = setInterval(() => { fetchData(); setCountdown(REFRESH_SEC); }, REFRESH_SEC * 1000);
    cdRef.current     = setInterval(() => setCountdown((v) => (v <= 1 ? REFRESH_SEC : v - 1)), 1000);
    tickRef.current   = setInterval(() => setTick((t) => t + 1), 1000);
    // ドリップタイマー: キュー量に応じて速度調整（最速150ms / 通常600ms）
    dripTimerRef.current = setInterval(() => {
      const qLen = feedQueueRef.current.length;
      if (qLen === 0) return;
      // キューが多いほど一度に多く流す
      const batch = qLen > 20 ? 4 : qLen > 8 ? 2 : 1;
      const newBatch: FeedItem[] = [];
      for (let i = 0; i < batch; i++) {
        const item = feedQueueRef.current.shift();
        if (!item) break;
        newBatch.push(item);
      }
      if (newBatch.length > 0) {
        setFeedItems((prev) => [...newBatch.reverse(), ...prev].slice(0, 60));
      }
    }, 400);
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
      height: "100vh",
      overflow: "hidden",
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
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: M.silver, letterSpacing: "0.08em" }}>
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
      <div style={{ flex: 1, overflow: "hidden", padding: "14px 20px", maxWidth: "1920px", width: "100%", margin: "0 auto", boxSizing: "border-box" as const, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
            <div style={{ width: "40px", height: "40px", border: `3px solid rgba(180,195,230,0.15)`, borderTop: `3px solid ${M.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : fetchError && !data ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, gap: "16px" }}>
            <div style={{ fontSize: "32px" }}>⚠️</div>
            <p style={{ color: M.red, fontSize: "16px", fontWeight: 700 }}>{fetchError}</p>
            <p style={{ color: M.silverFaint, fontSize: "12px" }}>次の更新まで自動でリトライします（{countdown}秒後）</p>
            <button onClick={fetchData} style={{ padding: "8px 20px", background: M.accentDim, border: `1px solid ${M.accent}`, borderRadius: "8px", color: M.accent, cursor: "pointer", fontSize: "13px" }}>
              今すぐ再試行
            </button>
          </div>
        ) : data ? (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 260px", gap: "14px", flex: 1, overflow: "hidden",
            /* 左列のみ自然高さ、中・右列はフル高さにするためgridRowsで制御 */
            gridTemplateRows: "1fr",
          }}>

            {/* ── 左: 全体 ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignSelf: "start", overflow: "visible" }}>

              {/* 全体カード */}
              <div style={{
                background: M.panelBg, border: `1px solid ${M.cardBorder}`,
                borderRadius: "18px", padding: "22px 20px",
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
                <p style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.14em", marginBottom: "20px", position: "relative" }}>
                  ▌ 全体の投票状況
                </p>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px", position: "relative" }}>
                  <DonutChart voted={data.overall.voted} total={data.overall.total} size={234} state={overallState} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", position: "relative" }}>
                  {/* 投票済み */}
                  <div style={{
                    background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.16)",
                    borderRadius: "12px", padding: "14px 10px", textAlign: "center",
                  }}>
                    <p style={{ fontSize: "9px", color: M.silverFaint, marginBottom: "6px", letterSpacing: "0.08em" }}>投票済み</p>
                    <p style={{ fontSize: "28px", fontWeight: 800, color: M.accent, lineHeight: 1, textShadow: M.accentGlow }}>
                      {data.overall.voted}
                    </p>
                    <p style={{ fontSize: "9px", color: M.silverFaint, marginTop: "5px" }}>人</p>
                  </div>
                  {data.overall.total > 0 ? (
                    <div style={{
                      background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.16)",
                      borderRadius: "12px", padding: "14px 10px", textAlign: "center",
                    }}>
                      <p style={{ fontSize: "9px", color: M.silverFaint, marginBottom: "6px", letterSpacing: "0.08em" }}>未投票</p>
                      <p style={{ fontSize: "28px", fontWeight: 800, color: M.red, lineHeight: 1, textShadow: M.redGlow }}>
                        {Math.max(0, data.overall.total - data.overall.voted)}
                      </p>
                      <p style={{ fontSize: "9px", color: M.silverFaint, marginTop: "5px" }}>人</p>
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
                  <div style={{ marginTop: "18px", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
                      <span style={{ fontSize: "10px", color: M.silverFaint }}>参加 {data.overall.total} 人</span>
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
                borderRadius: "14px", padding: "16px 20px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: M.cardHighlight }} />
                <p style={{ fontSize: "10px", color: M.silverFaint, letterSpacing: "0.12em", marginBottom: "12px" }}>凡例</p>
                {[
                  { color: M.accent, label: "投票進行中" },
                  { color: M.green,  label: "投票完了 (100%)" },
                  { color: M.red,    label: "投票率 50% 未満" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: color, boxShadow: `0 0 7px ${color}`, flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: M.silverDim }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 中央: 班別 ── */}
            <div style={{ overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
              {data.groups.filter((s) => s.total > 0).length > 0 ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: M.silverFaint, letterSpacing: "0.14em" }}>▌ 班別 投票状況</span>
                    <span style={{ fontSize: "9px", color: M.silverFaint }}>{data.groups.filter((s) => s.total > 0).length} 班</span>
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))",
                    gap: "17px",
                    overflowY: "auto",
                    flex: 1,
                    alignContent: "start",
                    scrollbarWidth: "none",
                  }}>
                    {data.groups.filter((s) => s.total > 0).map((s) => <GroupCard key={s.group} stat={s} />)}
                  </div>
                </>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: "200px", background: M.panelBg,
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
              minHeight: 0,
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
              {/* フィードリスト（下追加・compact） */}
              <div
                ref={feedContainerRef}
                style={{
                  flex: 1, overflowY: "auto", overflowX: "hidden",
                  scrollbarWidth: "none",
                }}
              >
                {feedItems.length === 0 ? (
                  <div style={{ padding: "24px 10px", textAlign: "center", color: M.silverFaint, fontSize: "11px" }}>
                    投票待機中...
                  </div>
                ) : (
                  <div>
                    {feedItems.map((item, i) => {
                      const isNewest = i === 0;
                      return (
                        <div key={item.id} style={{
                          padding: "3px 10px",
                          display: "flex", alignItems: "center", gap: "6px",
                          animation: isNewest ? "feedGlow 1.5s ease-out forwards, feedSlideIn 0.3s ease-out" : "none",
                        }}>
                          {/* ✓ */}
                          <span style={{ fontSize: "8px", color: "#34d399", flexShrink: 0, lineHeight: 1 }}>✓</span>
                          {/* 組名 */}
                          <span style={{
                            fontSize: "10px", fontWeight: 600, color: M.silver,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            maxWidth: "136px", flexShrink: 0,
                          }}>
                            {item.group}
                          </span>
                          {/* 社員番号 */}
                          <span style={{
                            fontSize: "10px", color: "#60a5fa",
                            letterSpacing: "0.05em", whiteSpace: "nowrap",
                            flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {item.emp}
                          </span>
                          {/* 時刻 */}
                          <span style={{ fontSize: "7px", color: M.red, flexShrink: 0 }}>
                            {item.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
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
        @keyframes feedSlideIn  { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes feedGlow     { 0% { background: rgba(52,211,153,0.22); } 60% { background: rgba(52,211,153,0.07); } 100% { background: transparent; } }
        /* スクロールバー非表示 */
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
