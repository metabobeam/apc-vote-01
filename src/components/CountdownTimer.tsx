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
        <span className={`text-xs font-semibold tracking-widest whitespace-nowrap ${isUrgent ? "text-red-400 animate-pulse" : "text-cyan-400/70"}`}>
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
  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center
          rounded-xl font-mono font-bold text-xl sm:text-2xl
          border transition-all duration-300
          ${urgent
            ? "border-red-500 bg-red-950/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
            : "border-cyan-500/40 bg-cyan-950/20 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
          }
        `}
      >
        {value}
      </div>
      <span className="text-xs text-slate-500 mt-1">{label}</span>
    </div>
  );
}
