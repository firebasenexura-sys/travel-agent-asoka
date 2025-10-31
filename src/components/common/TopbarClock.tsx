// src/components/common/TopbarClock.tsx
'use client';

import { useEffect, useState } from 'react';

export default function TopbarClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const t = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
        hour12: false,
      });
      setTime(t);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // suppressHydrationWarning mencegah warning saat server merender placeholder berbeda
  return (
    <strong className="tabular-nums" suppressHydrationWarning>
      {time ? `${time} WIB` : 'WIB'}
    </strong>
  );
}
