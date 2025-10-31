// src/app/(admin)/login/page.tsx
'use client';

import { useState } from 'react';
import Image from "next/image"; // Tetap impor Image, jaga-jaga kalau dibutuhkan lagi
import TimeWidget from "@/components/admin/TimeWidget";
import toast from 'react-hot-toast'; 
import { useRouter } from 'next/navigation';
import React from 'react';

// Import Firebase Auth functions (gunakan path relatif yang telah kita verifikasi)
import { adminSignIn, resetPassword } from '../../../../lib/firebase/auth'; 

export default function AdminLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const result = await adminSignIn(email, password);
        
        if (result.success) {
            toast.success('Login Berhasil! Mengarahkan ke Dashboard...');
            router.push('/dashboard'); 
        } else {
            const errorMessage = 'Email atau Password salah. Silakan coba lagi.';
            toast.error(errorMessage);
        }
        setIsLoading(false);
    };

    const handleResetPassword = async () => {
        if (!email) {
            toast.error('Mohon isi kolom Email terlebih dahulu untuk Reset Password.');
            return;
        }
        
        setIsLoading(true);
        const result = await resetPassword(email);
        setIsLoading(false);
        
        if (result.success) {
            toast.success('Link Reset Password telah dikirim ke email Anda. Silakan cek kotak masuk.');
        } else {
            toast.error('Gagal mengirim link. Pastikan email terdaftar di sistem.');
        }
    };


    return (
        // Wrapper utama. Default flex-col (mobile), lalu lg:flex-row (desktop split)
        <main className="min-h-screen flex flex-col lg:flex-row overflow-hidden">
            
            {/* KIRI: Visual & Info (Dark/Slate - Smooth Transition on Hover) */}
            {/* Tambahkan efek transform/scale pada sisi kiri secara keseluruhan */}
            <section 
                className="relative hidden lg:flex lg:w-1/2 flex-col justify-between bg-white text-gray-900 p-12 shadow-2xl 
                           transition duration-500 hover:shadow-2xl hover:shadow-gray-900/50 
                           transform hover:scale-[1.005] hover:z-10" // Efek scale pada seluruh sisi kiri
            >
                
                {/* 1. Latar Belakang Gambar Penuh (Kini satu-satunya gambar) */}
                <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat transition duration-700 transform hover:scale-[1.03]" 
                    style={{ backgroundImage: `url('/asoka-login.png')` }}
                >
                </div>

                {/* 2. Overlay Hitam/Gelap (Diberi blur untuk efek lembut) */}
                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[1px]"></div>

                {/* 3. Konten Utama (Relative Z-index) */}
                <div className="relative z-10 flex flex-col h-full text-white">
                    
                    {/* A. LOGO & BRAND (Paling Atas) */}
                    <div className="mb-auto pt-4">
                        <h2 className="text-4xl font-extrabold tracking-tight text-yellow-400 drop-shadow-md">
                            ASOKA TRAVEL
                        </h2>
                        <p className="text-xl font-light text-gray-200 mt-1 border-b-2 border-yellow-500/50 pb-2 inline-block">
                            Management System
                        </p>
                    </div>

                    {/* B. WIDGET WAKTU (Di Sudut Kanan Atas, di bawah logo) */}
                    {/* Tambahkan efek hover pada TimeWidget */}
                    <div className="absolute top-12 right-12 transition duration-300 transform hover:scale-[1.05] hover:rotate-1"> 
                         <TimeWidget /> 
                    </div>

                    {/* C. Konten Tengah (Bisa dikosongkan atau diisi teks lain jika perlu) */}
                    <div className="flex flex-col items-center justify-center flex-grow text-center py-12">
                        {/* Area ini sekarang dikosongkan karena gambar utama sudah di background */}
                        <p className="text-4xl font-extrabold tracking-tight text-gray-200 drop-shadow-md">
                            
                        </p>
                        <p className="mt-2 text-xl font-light text-gray-300">
                            
                        </p>
                    </div>

                    {/* D. FOOTER (Hak Cipta) - Di Paling Bawah */}
                    <div className="text-sm font-light text-gray-400 border-t border-gray-700 pt-4">
                        <p className="text-lg font-semibold text-white">Selamat Bekerja, Admin!</p>
                        <p className="mt-1 text-sm">Hak Cipta © {new Date().getFullYear()} Asoka Travel. All rights reserved Powered By Nexura</p>
                    </div>
                </div>
            </section>

            {/* KANAN: Form Login (Selalu Full Width di Mobile - Soft Yellow/Light) */}
            <section className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 p-6 sm:p-12">
                <div className="w-full max-w-sm space-y-8">
                    {/* Judul */}
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900">
                            Masuk
                        </h1>
                        <p className="mt-2 text-md text-gray-500">
                            Akses panel manajemen Anda
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Input Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="administrator@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 shadow-inner"
                                required
                            />
                        </div>

                        {/* Input Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                            <input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 shadow-inner"
                                required
                            />
                        </div>

                        {/* Tombol Login dengan Efek Loading dan Smooth Active/Hover */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-bold text-gray-900 shadow-lg transition duration-200 hover:bg-yellow-600 active:bg-yellow-700 disabled:opacity-50 flex items-center justify-center space-x-2 transform active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Memuat...</span>
                                </>
                            ) : (
                                <span>Masuk Dashboard</span>
                            )}
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                disabled={isLoading}
                                className="text-sm text-gray-500 hover:text-yellow-600 transition duration-200 disabled:opacity-50"
                            >
                                Lupa Password?
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
}