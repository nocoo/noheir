"use client";

import { useMemo } from "react";

interface Segment {
  label: string;
  startDate: Date;
  endDate: Date;
  type: "locked" | "open";
}

interface InvestmentTimelineProps {
  latestInvestDate: string;
  lockPeriodDays: number;
  openDays?: number | null;
  cycleDays?: number | null;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}

const DISPLAY_CYCLES = 3;

export function InvestmentTimeline({
  latestInvestDate,
  lockPeriodDays,
  openDays,
  cycleDays,
}: InvestmentTimelineProps) {
  const { segments, today, timelineStart, timelineEnd } = useMemo(() => {
    const investDate = new Date(latestInvestDate);
    const unlockDate = addDays(investDate, lockPeriodDays);
    const now = new Date();
    const segs: Segment[] = [];

    segs.push({
      label: "初始锁定",
      startDate: investDate,
      endDate: unlockDate,
      type: "locked",
    });

    const isCyclic = openDays != null && cycleDays != null && openDays > 0 && cycleDays > 0;

    if (isCyclic) {
      const lockedDaysInCycle = cycleDays - openDays;
      let cursor = unlockDate;
      for (let i = 0; i < DISPLAY_CYCLES; i++) {
        const openEnd = addDays(cursor, openDays);
        segs.push({
          label: `开放${i + 1}`,
          startDate: cursor,
          endDate: openEnd,
          type: "open",
        });
        const lockEnd = addDays(openEnd, lockedDaysInCycle);
        segs.push({
          label: `锁定${i + 1}`,
          startDate: openEnd,
          endDate: lockEnd,
          type: "locked",
        });
        cursor = lockEnd;
      }
    } else {
      const visualEnd = addDays(unlockDate, 90);
      segs.push({
        label: "可用",
        startDate: unlockDate,
        endDate: visualEnd,
        type: "open",
      });
    }

    const first = segs[0];
    const last = segs[segs.length - 1];
    if (!first || !last)
      return { segments: segs, today: now, timelineStart: now, timelineEnd: now };
    const start = first.startDate;
    const end = last.endDate;

    return { segments: segs, today: now, timelineStart: start, timelineEnd: end };
  }, [latestInvestDate, lockPeriodDays, openDays, cycleDays]);

  const totalMs = timelineEnd.getTime() - timelineStart.getTime();
  if (totalMs <= 0) return null;

  const todayOffset = ((today.getTime() - timelineStart.getTime()) / totalMs) * 100;
  const showToday = todayOffset >= 0 && todayOffset <= 100;

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="relative flex h-6 overflow-hidden rounded-md">
        {segments.map((seg, i) => {
          const width = ((seg.endDate.getTime() - seg.startDate.getTime()) / totalMs) * 100;
          if (width <= 0) return null;
          return (
            <div
              key={i}
              className={
                seg.type === "locked"
                  ? "flex items-center justify-center bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  : "flex items-center justify-center bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              }
              style={{ width: `${width}%` }}
              title={`${seg.label}: ${formatDate(seg.startDate)} - ${formatDate(seg.endDate)}`}
            >
              {width > 8 && (
                <span className="truncate px-1 text-[10px] font-medium">{seg.label}</span>
              )}
            </div>
          );
        })}
        {showToday && (
          <div
            className="absolute top-0 h-full w-px border-l-2 border-dashed border-foreground/60"
            style={{ left: `${todayOffset}%` }}
          />
        )}
      </div>

      {/* Date labels */}
      <div className="text-muted-foreground relative h-4 text-[10px]">
        <span className="absolute left-0">{formatDate(timelineStart)}</span>
        {showToday && (
          <span
            className="text-foreground absolute -translate-x-1/2 font-medium"
            style={{ left: `${todayOffset}%` }}
          >
            今天
          </span>
        )}
        <span className="absolute right-0">{formatDate(timelineEnd)}</span>
      </div>
    </div>
  );
}
