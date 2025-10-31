// Ini adalah file: app/gallery/page.tsx
// Halaman Galeri Penuh untuk Tamu
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
// --- PERBAIKAN PATH IMPORT DI SINI ---
import { auth, db, storage } from "@lib/firebase/config";
import { doc, getDoc } from 'firebase/firestore'; 

// --- Komponen Loader Sederhana ---
function PageLoader() {
    return (<div className="flex justify-center items-center h-screen"><i className="fas fa-spinner fa-spin text-2xl text-blue-600"></i><p className="ml-3 text-gray-600">Memuat galeri...</p></div>);
}

// === Halaman Galeri Utama ===
export default function GalleryPage() {
    const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxImage, setLightboxImage] = useState('');

    // --- Ambil Data Galeri ---
    useEffect(() => {
        const fetchGallery = async () => {
            setLoading(true);
            try {
                // Ambil data array imageUrls dari dokumen gallery/main
                const gallerySnap = await getDoc(doc(db, "gallery", "main"));
                const urls = gallerySnap.exists() ? (gallerySnap.data().imageUrls || []) : [];
                setGalleryUrls(urls);
            } catch (error) {
                console.error("Error loading gallery data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGallery();
    }, []);

    const openLightbox = (url: string) => {
        setLightboxImage(url);
        setLightboxOpen(true);
    };

    if (loading) return <PageLoader />;

    return (
        <div className="min-h-screen bg-gray-50 font-sans antialiased">
             <header className="bg-white shadow-sm h-16 flex items-center border-b border-gray-100">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex justify-between items-center">
                     <Link href="/">
                         <span className="text-blue-600 hover:text-blue-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/70 rounded-lg p-1 -m-1 transition-colors hover:bg-gray-100"><i className="fas fa-arrow-left mr-2"></i>Kembali ke Beranda</span>
                     </Link>
                     <h1 className="text-xl font-bold text-gray-900">Galeri Foto Asoka Trip</h1>
                 </div>
             </header>

            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Semua Foto Kami ({galleryUrls.length})</h2>
                
                {galleryUrls.length === 0 && !loading ? (
                    <p className="text-center text-gray-500 col-span-4 py-10 border border-dashed border-gray-300 rounded-lg bg-white">Belum ada foto di galeri. Silakan upload melalui CPanel.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {galleryUrls.map((url, index) => (
                            <div key={index} className="aspect-square rounded-lg overflow-hidden shadow-md">
                                <button
                                    onClick={() => openLightbox(url)}
                                    className="w-full h-full focus:outline-none focus:ring-4 focus:ring-blue-500/50 rounded-lg"
                                >
                                    <img 
                                        src={url} 
                                        alt={`Galeri ${index + 1}`} 
                                        className="w-full h-full object-cover transform hover:scale-105 transition duration-500" 
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

            </main>
            
            {/* Lightbox Modal (Full Screen Photo Viewer) */}
             {lightboxOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
                    onClick={() => setLightboxOpen(false)}
                >
                    <button
                        className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
                        aria-label="Tutup"
                        onClick={() => setLightboxOpen(false)}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                    <img
                        src={lightboxImage}
                        alt="Foto Galeri"
                        className="max-h-[90vh] w-auto rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Jangan tutup saat klik gambar
                    />
                </div>
            )}
        </div>
    );
}
