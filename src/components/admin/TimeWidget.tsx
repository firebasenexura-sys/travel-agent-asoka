// src/components/admin/TimeWidget.tsx
'use client';

import { useEffect, useState } from "react";

const formatDateTime = (date: Date) => {
  const optionsDate: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const optionsTime: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  };
  const locale = "id-ID";
  return {
    dateString: date.toLocaleDateString(locale, optionsDate),
    timeString: date.toLocaleTimeString(locale, optionsTime),
  };
};

export default function TimeWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { dateString, timeString } = formatDateTime(now);

  return (
    <div
      aria-label={`Waktu saat ini ${timeString}. ${dateString}`}
      className="rounded-xl bg-white/10 backdrop-blur p-4 shadow-lg ring-1 ring-white/20"
    >
      <div className="text-3xl font-extrabold tracking-tight text-white drop-shadow">
        {timeString}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-100/90">
        {dateString}
      </div>
    </div>
  );
}
