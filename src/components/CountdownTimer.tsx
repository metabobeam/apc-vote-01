"use client";

import React, { useEffect, useState } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CountdownTimerProps {
  deadline: string;
  onExpired?: () => void;
  onRefetch?: () => void;  // 60・10・1秒時にサーバー再取得を要求
}

// 再取得をトリガーする残り秒数
const REFETCH_THRESHOLDS = [60, 10, 1];

export default function CountdownTimer({ deadline, onExpired, onRefetch }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const triggeredRef = React.useRef<Set<number>>(new Set());

  useEffect(() => {
    // deadlineが変わったらトリガー済みセットをリセット
    triggeredRef.current = new Set();
  }, [deadline]);

  useEffect(() => {
    const calculate = () => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        onExpired?.();
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);

      // 60・10・1秒のタイミングでサーバー再取得
      for (const threshold of REFETCH_THRESHOLDS) {
        if (totalSeconds <= threshold && !triggeredRef.current.has(threshold)) {
          triggeredRef.current.add(threshold);
          onRefetch?.();
        }
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [deadline, onExpired, onRefetch]);

  // 締め切り時刻を "YYYY/MM/DD HH:MM" 形式で表示
  const deadlineLabel = (() => {
    const d = new Date(deadline);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${mo}/${day} ${h}:${mi}`;
  })();

  if (!timeLeft) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const totalHours = timeLeft.days * 24 + timeLeft.hours;
  const isUrgent = !isExpired && totalHours < 1;

  if (isExpired) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="text-red-400 text-base font-bold animate-pulse tracking-widest">
          ⏰ 投票締め切り
        </div>
        <p className="text-slate-600 text-xs">締切: {deadlineLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* カウントダウン（メイン） */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* 残り投票時間ラベル */}
        <span className={`text-xs font-semibold tracking-widest whitespace-nowrap ${isUrgent ? "text-red-400 animate-pulse" : ""}`}
          style={isUrgent ? {} : { color: "rgba(160,170,190,0.75)" }}>
          残り投票時間
        </span>
        {/* 数字 */}
        <div className="flex gap-2 sm:gap-3">
          {!isUrgent && (
            <TimeUnit value={pad(timeLeft.days * 24 + timeLeft.hours)} label="時間" urgent={isUrgent} />
          )}
          <TimeUnit value={pad(timeLeft.minutes)} label="分" urgent={isUrgent} />
          <TimeUnit value={pad(timeLeft.seconds)} label="秒" urgent={isUrgent} />
        </div>
      </div>
      {/* 締め切り時刻（サブテキスト・控えめ） */}
      <p className="text-slate-600 text-xs tracking-wide">
        締切: {deadlineLabel}
      </p>
    </div>
  );
}

function TimeUnit({ value, label, urgent }: { value: string; label: string; urgent: boolean }) {
  const litColor   = urgent ? "#f87171" : "#d8e0ee";             // 点灯セグメント色
  const dimColor   = urgent ? "rgba(248,113,113,0.12)" : "rgba(200,210,230,0.09)"; // 消灯セグメント色
  const glowColor  = urgent ? "rgba(239,68,68,0.55)"  : "rgba(180,190,215,0.40)";
  const bgColor    = urgent ? "rgba(69,10,10,0.7)"    : "rgba(10,11,16,0.80)";
  const borderColor = urgent ? "rgba(239,68,68,0.5)"  : "rgba(160,170,195,0.22)";

  return (
    <div className="flex flex-col items-center">
      <div
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: "10px",
          padding: "6px 10px",
          boxShadow: `0 0 14px ${glowColor}, inset 0 0 8px rgba(0,0,0,0.4)`,
          position: "relative",
          transition: "all 0.3s",
        }}
      >
        {/* 消灯セグメント（背景） */}
        <span style={{
          fontFamily: "'DSEG7Classic', monospace",
          fontWeight: "bold",
          fontSize: "clamp(28px, 6vw, 42px)",
          color: dimColor,
          letterSpacing: "0.05em",
          display: "block",
          lineHeight: 1,
          userSelect: "none",
        }}>
          {value}
        </span>
        {/* 点灯セグメント（前景） */}
        <span style={{
          fontFamily: "'DSEG7Classic', monospace",
          fontWeight: "bold",
          fontSize: "clamp(28px, 6vw, 42px)",
          color: litColor,
          letterSpacing: "0.05em",
          display: "block",
          lineHeight: 1,
          position: "absolute",
          top: "6px",
          left: "10px",
          textShadow: `0 0 8px ${litColor}, 0 0 20px ${glowColor}`,
        }}>
          {value}
        </span>
      </div>
      <span className="text-xs text-slate-500 mt-1.5">{label}</span>
    </div>
  );
}
