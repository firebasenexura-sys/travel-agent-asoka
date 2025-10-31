// src/components/AdminHeader.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopbarClock from '@/components/common/TopbarClock';
import toast from 'react-hot-toast';
import { signOut } from 'firebase/auth';

// ⚠️ Path ini benar karena file kita berada di: src/components/AdminHeader.tsx
// Naik 2x ke root (.. -> src, ../.. -> project root), lalu lib/firebase/config
import { auth } from '../../lib/firebase/config';

export default function AdminHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleBell = () => {
    toast('Tidak ada notifikasi baru', { icon: '🔔' });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Berhasil keluar');
      router.push('/login');
    } catch (err) {
      console.error(err);
      toast.error('Gagal logout');
    }
  };

  return (
    <header className="h-16 bg-white/90 backdrop-blur shadow-sm ring-1 ring-black/5">
      <div className="mx-auto max-w-7xl h-full px-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-yellow-400 grid place-content-center font-extrabold text-slate-900">
            A
          </div>
          <div>
            <div className="text-sm text-slate-500 leading-none">ASOKA ADMIN</div>
            <div className="text-base font-semibold leading-none">Management Panel</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 text-slate-700">
          <span className="hidden sm:inline text-sm">
            Jam: <TopbarClock />
          </span>

          {/* Notif */}
          <button
            type="button"
            onClick={handleBell}
            aria-label="Notifikasi"
            className="rounded-lg p-2 hover:bg-slate-100 transition"
          >
            <i className="fa-regular fa-bell text-lg" />
          </button>

          {/* Profile */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="rounded-full h-9 w-9 grid place-content-center bg-slate-100 text-slate-900 font-bold hover:bg-slate-200 transition"
              title="Akun"
            >
              <i className="fa-regular fa-user" />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-lg ring-1 ring-black/10 overflow-hidden z-50"
              >
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50"
                  onClick={() => { toast('Halaman profil belum tersedia', { icon: '👤' }); setOpen(false); }}
                >
                  <i className="fa-regular fa-id-badge mr-2" />
                  Profil
                </button>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50"
                  onClick={() => { toast('Pengaturan belum tersedia', { icon: '⚙️' }); setOpen(false); }}
                >
                  <i className="fa-solid fa-gear mr-2" />
                  Settings
                </button>
                <div className="h-px bg-slate-100" />
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  onClick={handleLogout}
                >
                  <i className="fa-solid fa-right-from-bracket mr-2" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
