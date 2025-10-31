// app/blog/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, db, storage } from "@lib/firebase/config";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore'; // Tambah doc dan getDoc

// --- Tipe Data Artikel (Sama dengan Landing Page) ---
interface Article {
    id: string; title: string; slug: string; imageUrl: string; createdAt: { toDate: () => Date }; 
    status: 'published' | 'draft';
    summary?: string; 
    content: string; 
}

// Tambahan Tipe Data untuk Footer dan Settings
interface SiteSettings {
  siteName: string; 
  socialInstagram?: string; socialFacebook?: string; socialTiktok?: string;
}

interface FooterSettings {
    copyrightText: string;
    description: string;
}


// --- Komponen Loader/Skeleton (Sama) ---
function SkeletonLoader() {
  return (
    <div className="max-w-7xl mx-auto p-8 animate-pulse">
        <div className="h-10 bg-gray-200 rounded w-1/3 mb-10"></div>
        <div className="space-y-6">
            <div className="flex space-x-4">
                <div className="w-1/3 h-40 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-3 py-1">
                    <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mt-4"></div>
                </div>
            </div>
            <div className="flex space-x-4">
                <div className="w-1/3 h-40 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-3 py-1">
                    <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mt-4"></div>
                </div>
            </div>
        </div>
    </div>
  );
}


// === Komponen Utama Halaman Blog ===
export default function BlogListPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null); // State baru
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(null); // State baru
  const [loading, setLoading] = useState(true);

  // --- Fungsi: Ambil Semua Artikel Published dan Pengaturan Footer ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Ambil Pengaturan Umum (diperlukan untuk nama site & sosmed di footer)
        const settingsSnap = await getDoc(doc(db, "settings", "landingPage"));
        const defaultSettings: SiteSettings = { 
             siteName: "Asoka Tour & Travel", socialInstagram: "", socialFacebook: "", socialTiktok: ""
        };
        const settingsData = settingsSnap.exists()
          ? { ...defaultSettings, ...(settingsSnap.data() as SiteSettings) }
          : defaultSettings;
        setSettings(settingsData);
        
        // 2. Ambil Pengaturan Footer
        const footerSnap = await getDoc(doc(db, "settings", "footer"));
        const defaultFooter: FooterSettings = {
            copyrightText: `© ${new Date().getFullYear()} ${settingsData.siteName}. All rights reserved.`,
            description: ""
        };
        const footerData = footerSnap.exists()
            ? { ...defaultFooter, ...(footerSnap.data() as FooterSettings) }
            : defaultFooter;
        setFooterSettings(footerData);

        // 3. Ambil Artikel Blog
        const q = query(
          collection(db, "blogPosts"), 
          where("status", "==", "published"), 
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        
        const articlesData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() as Omit<Article, 'id'> 
        } as Article));
        
        setArticles(articlesData);

      } catch (error) {
        console.error("Error loading blog posts or settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Helper untuk Link Detail Artikel (Sama) ---
  const getArticleDetailLink = (article: Article) => {
      const identifier = article.slug || article.id; 
      return identifier ? `/blog/${identifier}` : '#';
  };


  if (loading || !settings || !footerSettings) return <SkeletonLoader />;

  return (
    <div className="font-sans antialiased text-gray-800 min-h-screen flex flex-col">
      
      {/* Header Statis (Placeholder sederhana) */}
      <header className="bg-white shadow-md z-30 h-16"></header>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8 flex-grow"> {/* flex-grow agar footer ada di bawah */}
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Semua Artikel Blog</h1>
        <p className="text-lg text-gray-600 mb-10">Temukan panduan, tips, dan inspirasi perjalanan terbaru dari Asoka Trip.</p>

        {articles.length === 0 && (
            <div className="text-center p-10 bg-gray-50 rounded-lg">
                <p className="text-xl text-gray-500">Saat ini belum ada artikel yang dipublikasikan.</p>
                <p className="text-sm text-gray-400 mt-2">Silakan cek kembali nanti atau hubungi Admin.</p>
            </div>
        )}

        {/* Daftar Artikel */}
        <div className="space-y-10">
          {articles.map((article) => (
            <div key={article.id} className="flex flex-col md:flex-row gap-6 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-lg transition-all hover:shadow-xl">
              
              {/* Gambar Artikel */}
              <Link href={getArticleDetailLink(article)} className="md:w-1/3 w-full aspect-video md:aspect-[4/3] bg-gray-200 overflow-hidden cursor-pointer block flex-shrink-0">
                <img 
                    src={article.imageUrl || 'https://placehold.co/600x450/e2e8f0/94a3b8?text=Artikel'} 
                    alt={article.title} 
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" 
                />
              </Link>
              
              {/* Konten Ringkas */}
              <div className="p-6 md:p-8 flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">
                    <i className="fas fa-calendar-alt mr-2"></i> 
                    {article.createdAt?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) || 'Tanggal tidak tersedia'}
                </p>
                <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition">
                  <Link href={getArticleDetailLink(article)}>{article.title}</Link>
                </h2>
                <p className="text-gray-600 line-clamp-3 mb-4">
                    {article.summary || (article.content ? article.content.substring(0, 200) + (article.content.length > 200 ? '...' : '') : 'Baca artikel selengkapnya...')}
                </p>
                
                <Link href={getArticleDetailLink(article)} className="text-blue-600 font-semibold hover:underline flex items-center gap-1">
                    Baca Selengkapnya <i className="fas fa-arrow-right ml-1 text-xs"></i>
                </Link>
              </div>
            </div>
          ))}
        </div>
        
      </div>

      {/* Footer (MEMUAT DARI CMS) */}
       <footer className="bg-gray-800 text-white py-8 mt-auto"> {/* mt-auto untuk mendorong footer ke bawah */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                 {/* Jika ada Deskripsi Footer di CMS, tampilkan */}
                 {footerSettings?.description && (
                     <p className="text-md mb-4 text-gray-300 whitespace-pre-line">
                         {footerSettings.description}
                     </p>
                 )}
                 
                 {/* Social Media Links (memakai settings yang baru dimuat) */}
                 <div className="flex justify-center space-x-6 mb-4">
                      {settings?.socialInstagram && <a href={settings.socialInstagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-500 transition"><i className="fab fa-instagram fa-2x"></i></a>}
                      {settings?.socialFacebook && <a href={settings.socialFacebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition"><i className="fab fa-facebook fa-2x"></i></a>}
                      {settings?.socialTiktok && <a href={settings.socialTiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition"><i className="fab fa-tiktok fa-2x"></i></a>}
                 </div>
                 
                 {/* Tampilkan Teks Copyright dari CMS */}
                 <p className="text-sm text-gray-400"> 
                    {footerSettings?.copyrightText}
                 </p>
            </div>
       </footer>
    </div>
  );
}