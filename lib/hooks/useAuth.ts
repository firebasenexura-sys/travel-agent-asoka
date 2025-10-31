// lib/hooks/useAuth.ts (FULL PATCHED)
'use client'; 

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth'; // <<< IMPORT USER TYPE
import { auth } from '../firebase/config'; 
import { useRouter, usePathname } from 'next/navigation';

export function useAuth() {
    // [KOREKSI DI SINI] Tentukan state dapat berupa User atau null
    const [user, setUser] = useState<User | null>(null); 
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        // Langganan perubahan status otentikasi
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // currentUser sudah bertipe User | null
            setUser(currentUser); 
            setLoading(false);
        });

        // Cleanup saat komponen dibongkar
        return () => unsubscribe();
    }, []);

    return { user, loading };
}


// --- HOOK PROTEKSI ROUTE ---

/**
 * Custom hook untuk memproteksi halaman admin
 */
export function useAdminProtect() {
    // Gunakan useAuth() yang sudah diperbaiki
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Jika masih memuat, tunggu
        if (loading) return; 

        // Cek jika user tidak ada DAN BUKAN di halaman login
        if (!user && pathname !== '/login') {
            // Redirect ke halaman login jika user belum login
            router.replace('/login'); 
        }

        // Cek jika user sudah login DAN berada di halaman login
        if (user && pathname === '/login') {
            // Redirect ke dashboard jika user sudah login tapi mencoba akses /login
            router.replace('/dashboard'); 
        }

    }, [user, loading, router, pathname]);

    // Kembalikan status loading dan user untuk digunakan di layout/page
    return { user, loading, isAuthenticated: !!user };
}