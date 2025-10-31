// app/blog/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import Link from "next/link";

// --- Tipe Data ---
interface Article {
  id: string;
  title: string;
  slug: string;
  imageUrl: string;
  createdAt: { toDate: () => Date };
  status: "published" | "draft";
  content: string;
  authorID: string;
}
interface SiteSettings {
  siteName: string;
  socialInstagram?: string;
  socialFacebook?: string;
  socialTiktok?: string;
}
interface FooterSettings {
  copyrightText: string;
  description: string;
}

// === Skeleton ===
function ArticleSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-8 bg-gray-300 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-10"></div>
      <div className="h-64 bg-gray-300 rounded-lg mb-8"></div>
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-11/12"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

// === Halaman ===
export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();

  const [article, setArticle] = useState<Article | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!slug) {
          setLoading(false);
          return;
        }

        // Settings umum
        const settingsSnap = await getDoc(doc(db, "settings", "landingPage"));
        const defaultSettings: SiteSettings = {
          siteName: "Asoka Tour & Travel",
          socialInstagram: "",
          socialFacebook: "",
          socialTiktok: "",
        };
        const settingsData = settingsSnap.exists()
          ? { ...defaultSettings, ...(settingsSnap.data() as SiteSettings) }
          : defaultSettings;
        setSettings(settingsData);

        // Footer settings
        const footerSnap = await getDoc(doc(db, "settings", "footer"));
        const defaultFooter: FooterSettings = {
          copyrightText: `© ${new Date().getFullYear()} ${settingsData.siteName}. All rights reserved.`,
          description: "",
        };
        const footerData = footerSnap.exists()
          ? { ...defaultFooter, ...(footerSnap.data() as FooterSettings) }
          : defaultFooter;
        setFooterSettings(footerData);

        // Artikel
        const q = query(
          collection(db, "blogPosts"),
          where("slug", "==", slug),
          where("status", "==", "published"),
          limit(1)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setArticle(null);
        } else {
          const data = snapshot.docs[0].data();
          setArticle({
            ...(data as Article), // Type assertion pada saat destructure
            id: snapshot.docs[0].id,
            content: data.content || "Konten belum diisi.",
          });
        }
      } catch (err) {
        console.error("Error loading article or settings:", err);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  if (loading || !settings || !footerSettings) {
    return (
      <>
        <header className="bg-white shadow-md z-30 h-16"></header>
        <ArticleSkeleton />
      </>
    );
  }

  if (!article) {
    notFound();
  }

  return (
    <div className="font-sans antialiased text-gray-800 min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-md z-30 h-16"></header>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8 flex-grow">
        {/* Breadcrumb */}
        <p className="text-sm text-blue-600 mb-6">
          <Link href="/" className="hover:underline">
            Home
          </Link>{" "}
          /<Link href="/blog" className="hover:underline"> Blog</Link> /
          <span className="text-gray-500"> {article.title}</span>
        </p>

        {/* Judul & Meta */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
          {article.title}
        </h1>
        <p className="text-md text-gray-600 mb-8">
          <i className="fas fa-calendar-alt mr-2 text-gray-400"></i>
          Dipublikasikan pada:{" "}
          {article.createdAt?.toDate().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        {/* Gambar Utama */}
        {article.imageUrl && (
          <div className="mb-8 overflow-hidden rounded-xl shadow-lg">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-auto object-cover max-h-[500px]"
            />
          </div>
        )}

        {/* Konten */}
        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="whitespace-pre-line leading-relaxed">{article.content}</p>
        </div>

        {/* Back */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            href="/blog"
            className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-full shadow-md hover:bg-blue-700 transition text-sm flex items-center justify-center w-fit"
          >
            <i className="fas fa-arrow-left mr-2"></i> Kembali ke Daftar Artikel
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {footerSettings.description && (
            <p className="text-md mb-4 text-gray-300 whitespace-pre-line">
              {footerSettings.description}
            </p>
          )}

          <div className="flex justify-center space-x-6 mb-4">
            {settings.socialInstagram && (
              <a
                href={settings.socialInstagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-pink-500 transition"
              >
                <i className="fab fa-instagram fa-2x"></i>
              </a>
            )}
            {settings.socialFacebook && (
              <a
                href={settings.socialFacebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-500 transition"
              >
                <i className="fab fa-facebook fa-2x"></i>
              </a>
            )}
            {settings.socialTiktok && (
              <a
                href={settings.socialTiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-black transition"
              >
                <i className="fab fa-tiktok fa-2x"></i>
              </a>
            )}
          </div>

          <p className="text-sm text-gray-400">
            {footerSettings.copyrightText}
          </p>
        </div>
      </footer>
    </div>
  );
}
