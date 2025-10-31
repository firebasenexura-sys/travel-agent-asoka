// app/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, db, storage } from "@lib/firebase/config";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore'; 

// --- INTERFACES BARU ---
interface Testimonial { id: string; customerName: string; quote: string; }
interface FAQ { id: string; question: string; answer: string; }
// --- END INTERFACES BARU ---

interface FooterLink { title: string; url: string; }
interface FooterColumn { title: string; links: FooterLink[]; }

interface SiteSettings {
  siteName: string; logoUrl?: string; heroTitle: string; heroSubtitle: string;
  socialInstagram?: string; socialFacebook?: string; socialTiktok?: string; socialYoutube?: string; 
  contactPhone: string; contactEmail?: string; contactAddress?: string; 
  aboutText: string; heroImages?: string[]; footerDescription?: string;
  copyrightText: string; 
  googleMapsLink?: string; 
  footerLinkColumns?: FooterColumn[]; 
  latitude?: string;
  longitude?: string;

  footerSocialInstagram?: string; 
  footerSocialFacebook?: string; 
  footerSocialTiktok?: string; 
  footerSocialYoutube?: string;
}

interface Article {
  id: string; title: string; slug: string; imageUrl: string; createdAt: { toDate: () => Date } | Timestamp; 
  status: 'published' | 'draft'; summary?: string; content: string; 
}

interface Package {
  id: string; name: string; category: string; price: number; unit: string;
  buttonText: string; description: string; imageUrls: string[]; duration?: string;
  location?: string; features?: string[]; exclusions?: string; itinerary?: string;
  terms?: string; youtubeUrl?: string; minPax?: number; maxPax?: number; slug?: string;
}

interface WhyUsPoint { id: string; icon: string; title: string; description: string; }

type AnySettings = Record<string, any>;

// --- NORMALISASI URL SOSMED (tetap) ---
function normalizeSocialUrl(kind: 'instagram'|'facebook'|'tiktok'|'youtube', raw?: string) {
  if (!raw) return "";
  let v = String(raw).trim();
  if (!v) return "";
  const hasProto = /^https?:\/\//i.test(v);
  const looksLikeHandle = /^@?[a-z0-9_.-]+$/i.test(v);
  if (looksLikeHandle) {
    const handle = v.startsWith('@') ? v.slice(1) : v;
    switch (kind) {
      case 'instagram': v = `https://instagram.com/${handle}`; break;
      case 'facebook':  v = `https://facebook.com/${handle}`;  break;
      case 'tiktok':    v = `https://tiktok.com/@${handle}`;   break;
      case 'youtube':   v = `https://youtube.com/@${handle}`;  break;
    }
  } else if (!hasProto) {
    v = `https://${v}`;
  }
  return v;
}

// --- AMBIL SOSMED: prioritas footerSocial* (tetap) ---
function getSocial(s: AnySettings) {
  const ig = s.footerSocialInstagram ?? s.socialInstagram ?? "";
  const fb = s.footerSocialFacebook  ?? s.socialFacebook  ?? "";
  const tk = s.footerSocialTiktok    ?? s.socialTiktok    ?? "";
  const yt = s.footerSocialYoutube   ?? s.socialYoutube   ?? "";
  return {
    instagram: normalizeSocialUrl('instagram', ig),
    facebook:  normalizeSocialUrl('facebook',  fb),
    tiktok:    normalizeSocialUrl('tiktok',    tk),
    youtube:   normalizeSocialUrl('youtube',   yt),
  };
}

// --- REFERRAL STORAGE (tetap) ---
const REF_KEY = 'asoka_ref_source';
const getReferralCode = () => {
  if (typeof window === 'undefined') return; 
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) localStorage.setItem(REF_KEY, refCode.toLowerCase());
    return localStorage.getItem(REF_KEY) || null;
  } catch { return null; }
};

// --- NAMA SUMBER YANG RAPIH UNTUK CHAT ---
function prettifySource(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();

  // Mapping khusus
  if (['nexura','nx','nexuragroup','nexuragroups','nexuragroups.com','nexuragroup.com'].includes(v)) {
    return 'Nexura';
  }
  if (['dieng','dienghebat','dieng-hebat','dieng hebat','dienghebat.id','dieng.id'].includes(v)) {
    return 'Dieng Hebat';
  }

  // Fallback: kapitalisasi setiap kata/fragmen
  return v
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

// --- TEMPLATE CHAT WA (sesuai permintaan) ---
function buildWaMessageFromTemplate(sourceName?: string | null) {
  // Template: “Hi Asoka, saya lihat promonya dari (sumber).Saya mau tanya paket trip yang tersedia ya.
  // Perbaiki spasi setelah titik agar lebih natural.
  if (sourceName) {
    return `Hi Asoka, saya lihat promonya dari ${sourceName}. Saya mau tanya paket trip yang tersedia ya.`;
  }
  // Jika tidak ada sumber, kirim versi umum (tanpa "dari ...")
  return `Hi Asoka, saya mau tanya paket trip yang tersedia ya.`;
}

// --- LINK WA GENERATOR ---
function makeWaLink(phone: string, message: string) {
  const numOnly = phone.replace(/\D/g, '');
  const phoneNum = numOnly.startsWith('62') ? numOnly : '62' + numOnly.substring(1);
  return `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
}

// --- MAPS & UTIL (tetap) ---
const buildMapsEmbedLink = (settings: SiteSettings | null): string | null => {
  if (!settings || !settings.latitude || !settings.longitude) return null;
  const lat = settings.latitude.trim();
  const lng = settings.longitude.trim();
  if (!lat || !lng) return null;
  return `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
};
const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};
function SkeletonLoader() { 
  return (
    <div className="font-sans antialiased text-gray-800">
      <header className="sticky top-0 bg-white shadow-md z-30 h-16"></header>
      <div className="animate-pulse space-y-8 p-8 max-w-7xl mx-auto">
        <div className="h-[60vh] bg-gray-300 rounded-xl"></div>
        <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="h-72 bg-gray-200 rounded-xl"></div>
          <div className="h-72 bg-gray-200 rounded-xl"></div>
          <div className="h-72 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}

// === KOMPONEN BARU: Testimonial Slider ===
function TestimonialSlider({ testimonials }: { testimonials: Testimonial[] }) {
    const [current, setCurrent] = useState(0);

    // Auto-slide
    useEffect(() => {
        if (testimonials.length > 1) {
            const timer = setInterval(() => {
                setCurrent(prev => (prev + 1) % testimonials.length);
            }, 6000); // Ganti setiap 6 detik
            return () => clearInterval(timer);
        }
    }, [testimonials.length]);

    if (testimonials.length === 0) return null;
    
    // Perhitungan transform untuk slide halus
    const sliderStyle = {
        transform: `translateX(-${current * 100}%)`,
    };

    return (
        <div className="relative max-w-3xl mx-auto">
            {/* Konten Slider */}
            <div className="overflow-hidden rounded-xl shadow-xl border border-gray-100 bg-white">
                <div 
                    className="flex transition-transform duration-700 ease-in-out" 
                    style={sliderStyle}
                >
                    {testimonials.map((t) => (
                        <div 
                            key={t.id}
                            className="flex-shrink-0 w-full p-8 md:p-10 text-center"
                        >
                            <i className="fa-solid fa-quote-left text-blue-400 text-3xl mb-4 opacity-70"></i>
                            <p className="text-lg md:text-xl italic text-gray-700 leading-relaxed mb-5">
                                "{t.quote}"
                            </p>
                            <div className="text-md font-bold text-blue-600">
                                — {t.customerName}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigasi Dot */}
            <div className="flex justify-center space-x-2 mt-8">
                {testimonials.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrent(index)}
                        className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                            index === current ? 'bg-blue-600 scale-125' : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                        aria-label={`Lihat testimonial ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
// === END KOMPONEN TESTIMONIAL SLIDER ===

// === KOMPONEN BARU: FAQ Card (Accordion) ===
function FAQCard({ question, answer }: FAQ) {
    return (
        <details className="group rounded-xl p-4 bg-white shadow-md border border-gray-200 cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-blue-400">
            <summary className="flex justify-between items-center font-semibold text-gray-800 focus:outline-none list-none text-lg">
                <span className="flex-1">{question}</span>
                <span className="transition transform duration-300 group-open:rotate-180 text-blue-600 ml-3">
                    <i className="fa-solid fa-chevron-down"></i>
                </span>
            </summary>
            <div className="mt-3 pt-3 border-t border-gray-100 text-gray-600 leading-relaxed text-base">
                {answer}
            </div>
        </details>
    );
}
// === END KOMPONEN FAQ CARD ===


export default function LandingPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [whyUs, setWhyUs] = useState<WhyUsPoint[]>([]); 
  const [articles, setArticles] = useState<Article[]>([]); 
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State untuk Hamburger Menu

  useEffect(() => {
    getReferralCode(); // simpan ref bila ada
    const fetchData = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "landingPage"));
        const defaultSettings: SiteSettings = { 
          siteName: "Asoka Tour & Travel",
          heroTitle: "Jelajahi Dunia",
          heroSubtitle: "Partner Perjalanan Terpercaya",
          contactPhone: "+628123456789",
          aboutText: "Perusahaan travel terbaik di Indonesia.",
          copyrightText: `© ${new Date().getFullYear()} Asoka Tour & Travel. All rights reserved.`,
          socialInstagram: "", socialFacebook: "", socialTiktok: "", socialYoutube: "", 
          heroImages: [],
          googleMapsLink: "", footerLinkColumns: [], latitude: "0", longitude: "0", contactAddress: "Alamat belum diatur.",
          footerSocialInstagram: "", footerSocialFacebook: "", footerSocialTiktok: "", footerSocialYoutube: ""
        };
        const settingsData = settingsSnap.exists()
          ? { ...defaultSettings, ...(settingsSnap.data() as SiteSettings) }
          : defaultSettings;
        setSettings(settingsData);

        const packagesQuery = query(collection(db, "packages"), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(6));
        const packagesSnap = await getDocs(packagesQuery);
        setPackages(packagesSnap.docs.map(doc => ({ 
          ...doc.data() as Package, 
          id: doc.id, 
          features: (doc.data().features || []) as string[],
          imageUrls: (doc.data().imageUrls || []) as string[]
        } as Package)));

        const whyUsQuery = query(collection(db, "whyUsPoints"), orderBy("createdAt", "asc"), limit(6));
        const whyUsSnap = await getDocs(whyUsQuery);
        setWhyUs(whyUsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhyUsPoint)));

        const articlesQuery = query(collection(db, "blogPosts"), where("status", "==", "published"), orderBy("createdAt", "desc"), limit(3));
        const articlesSnap = await getDocs(articlesQuery);
        setArticles(articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Article, 'id'> } as Article)));

        const gallerySnap = await getDoc(doc(db, "gallery", "main"));
        const gUrls = gallerySnap.exists() ? (gallerySnap.data().imageUrls || []) : [];
        setGalleryUrls(gUrls);

        // --- FETCH DATA BARU ---
        const testimonialsQuery = query(collection(db, "testimonials"), orderBy("createdAt", "desc"), limit(5));
        const testimonialsSnap = await getDocs(testimonialsQuery);
        setTestimonials(testimonialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Testimonial)));

        const faqsQuery = query(collection(db, "faqs"), orderBy("createdAt", "asc"), limit(5));
        const faqsSnap = await getDocs(faqsQuery);
        setFaqs(faqsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FAQ)));
        // --- END FETCH DATA BARU ---

      } catch (error) {
        console.error("Error loading frontend data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []); 

  useEffect(() => {
    if (settings?.heroImages && settings.heroImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % settings.heroImages!.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [settings]);

  if (loading || !settings) return <SkeletonLoader />;

  // --- BANGUN PESAN WA BERDASARKAN REF ---
  const sourcePretty = prettifySource(
    (typeof window !== 'undefined' && localStorage.getItem(REF_KEY)) || null
  );
  const defaultWaMessage = buildWaMessageFromTemplate(sourcePretty);

  const getPackageDetailLink = (pkg: Package) => (pkg.slug || pkg.id ? `/packages/${pkg.slug || pkg.id}` : '#');
  const getArticleDetailLink = (a: Article) => (a.slug || a.id ? `/blog/${a.slug || a.id}` : '#');

  const social = getSocial(settings || {});
  const hasAnySocial = !!(social.instagram || social.facebook || social.tiktok || social.youtube);
  
  // Fungsi untuk menutup menu dan navigasi
  const handleNavClick = (href: string) => {
    setIsMenuOpen(false);
    // Navigasi manual ke anchor (untuk smooth scroll jika perlu)
    if (typeof window !== 'undefined' && href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="font-sans antialiased text-gray-800">
      {/* Header */}
      <header className="sticky top-0 bg-white shadow-md z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.siteName}
                className="h-20 w-auto object-contain transition duration-300"
              />
            ) : (
              <span className="text-xl font-extrabold text-blue-600 transition duration-300">{settings.siteName}</span>
            )}
          </div>
          
          {/* Navigasi Desktop */}
          <nav className="hidden md:flex space-x-8 text-sm font-medium">
            <a href="#packages" className="text-gray-600 hover:text-blue-600 transition duration-300">Paket Trip</a>
            <a href="#whyus" className="text-gray-600 hover:text-blue-600 transition duration-300">Kenapa Kami</a>
            <a href="#testimonials" className="text-gray-600 hover:text-blue-600 transition duration-300">Testimonial</a> 
            <a href="#faq" className="text-gray-600 hover:text-blue-600 transition duration-300">FAQ</a> 
            <a href="#articles" className="text-gray-600 hover:text-blue-600 transition duration-300">Blog</a> 
            <a href="#gallery" className="text-gray-600 hover:text-blue-600 transition duration-300">Galeri</a>
            <a href="#contact" className="text-gray-600 hover:text-blue-600 transition duration-300">Kontak</a>
          </nav>
          
          {/* Tombol WA & Menu Mobile */}
          <div className="flex items-center gap-4">
            <a 
              href={makeWaLink(settings.contactPhone, defaultWaMessage)} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-green-500 text-white font-semibold py-2 px-4 rounded-full shadow-md hover:bg-green-600 transition duration-300 text-sm hidden md:flex items-center gap-2 transform hover:scale-105"
            >
              <i className="fa-brands fa-whatsapp"></i> Chat Sekarang
            </a>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="md:hidden text-gray-600 hover:text-blue-600 focus:outline-none text-xl"
              aria-label="Toggle Menu"
            >
              <i className={`fa-solid ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
          </div>

        </div>
      </header>
      
      {/* Menu Mobile Off-Canvas */}
      <div 
        className={`fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 md:hidden ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsMenuOpen(false)}
      >
        <div 
          className={`bg-white w-3/4 max-w-sm h-full shadow-2xl transition-transform duration-300 p-6 space-y-4 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {['packages', 'whyus', 'testimonials', 'faq', 'articles', 'gallery', 'contact'].map((id) => (
            <a 
              key={id} 
              href={`#${id}`}
              onClick={() => handleNavClick(`#${id}`)}
              className="block text-lg font-medium text-gray-700 hover:text-blue-600 transition-colors py-2 border-b border-gray-100 capitalize"
            >
              {id.replace('packages', 'Paket Trip').replace('whyus', 'Kenapa Kami').replace('testimonials', 'Testimonial').replace('faq', 'FAQ').replace('articles', 'Blog').replace('gallery', 'Galeri').replace('contact', 'Kontak')}
            </a>
          ))}
          <a 
            href={makeWaLink(settings.contactPhone, defaultWaMessage)} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="block w-full text-center bg-green-500 text-white font-semibold py-3 rounded-full shadow-md hover:bg-green-600 transition mt-4"
          >
            <i className="fa-brands fa-whatsapp mr-2"></i> Chat Sekarang
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="relative h-[60vh] md:h-[80vh] flex items-center justify-center bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 bg-black/60 z-10"></div>
        <div className="z-20 text-center text-white p-6 max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 animate-fade-in-up">
            {settings.heroTitle || "Jelajahi Keindahan Nusantara"}
          </h1>
          <p className="text-lg md:text-xl font-medium mb-8 animate-fade-in-up delay-200">
            {settings.heroSubtitle || "Partner perjalanan terpercaya, siap mewujudkan trip impian Anda."}
          </p>
          <a 
            href={makeWaLink(settings.contactPhone, defaultWaMessage)} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="bg-blue-600 text-white font-semibold py-3 px-8 rounded-full shadow-xl hover:bg-blue-700 transition duration-300 transform hover:scale-105"
          >
            <i className="fa-solid fa-route mr-2"></i> Konsultasi Trip Gratis
          </a>
        </div>
        <div className="absolute inset-0">
          {settings.heroImages && settings.heroImages.length > 0 ? (
            settings.heroImages.map((url, index) => (
              <img
                key={index}
                src={url} 
                alt={`Slide ${index + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))
          ) : (
            <img src="https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=2070&auto=format&fit=crop" alt="Hero Default" className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-800">Paket Trip Unggulan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {packages.length > 0 ? (
            packages.map(pkg => (
              <div key={pkg.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <Link href={getPackageDetailLink(pkg)} className="aspect-video bg-gray-200 overflow-hidden cursor-pointer block">
                  <img src={pkg.imageUrls?.[0] || 'https://placehold.co/600x337/e2e8f0/94a3b8?text=Trip'} alt={pkg.name} className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" />
                </Link>
                <div className="p-5">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-1">{pkg.category.replace(/-/g, ' ')}</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 truncate">{pkg.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{pkg.description}</p>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <p className="text-lg font-bold text-green-600">
                      {pkg.price > 0 ? formatCurrency(pkg.price) : 'Harga Terbaik'}
                      <span className="text-sm font-normal text-gray-500">{pkg.unit}</span>
                    </p>
                    <Link href={getPackageDetailLink(pkg)} className="bg-yellow-500 text-gray-900 font-semibold py-2 px-4 rounded-full shadow-md hover:bg-yellow-600 transition duration-300 text-sm hover:scale-[1.02]">
                      Lihat Detail
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 col-span-3">Belum ada paket trip aktif yang ditemukan.</p>
          )}
        </div>
      </section>

      {/* Why Us */}
      <section id="whyus" className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-800">Mengapa Memilih Kami?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {whyUs.length > 0 ? (
              whyUs.map((point, index) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-md text-center border border-gray-100 transition-all duration-300 hover:shadow-lg hover:border-blue-300 transform hover:-translate-y-1">
                  <div className="w-14 h-14 mx-auto rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mb-4 transition-all duration-300 transform hover:scale-110">
                    <i className={`fa-solid fa-${point.icon} fa-2x`}></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{point.title}</h3>
                  <p className="text-gray-600 text-sm">{point.description}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 col-span-3">Poin keunggulan belum diatur di Hpanel.</p>
            )}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section id="articles" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-800">Artikel Terbaru</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.length > 0 ? (
            articles.map((article) => (
              <div key={article.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <Link href={getArticleDetailLink(article)} className="aspect-[16/9] bg-gray-200 overflow-hidden cursor-pointer block">
                  <img src={article.imageUrl || 'https://placehold.co/600x337/e2e8f0/94a3b8?text=Blog'} alt={article.title} className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500" />
                </Link>
                <div className="p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    {article.createdAt instanceof Timestamp ? article.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tanggal tidak tersedia'}
                  </p>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 truncate hover:text-blue-600 transition duration-300">
                    <Link href={getArticleDetailLink(article)}>{article.title}</Link>
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {article.summary || (article.content ? article.content.substring(0, 150) + (article.content.length > 150 ? '...' : '') : 'Baca artikel selengkapnya...')}
                  </p>
                  <div className="mt-4">
                    <Link href={getArticleDetailLink(article)} className="text-blue-600 font-semibold text-sm hover:underline transition duration-300 hover:text-blue-700">
                      Baca Selengkapnya <i className="fa-solid fa-arrow-right ml-1"></i>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 col-span-3">Belum ada artikel yang dipublikasikan.</p>
          )}
        </div>
        {articles.length > 0 && (
          <div className="text-center mt-8">
            <Link href="/blog" className="bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-full shadow-md hover:bg-gray-200 transition duration-300 text-sm flex items-center justify-center mx-auto w-fit transform hover:scale-[1.02]">
              Lihat Semua Artikel <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
          </div>
        )}
      </section>

      {/* Gallery */}
      <section id="gallery" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-800">Galeri Kami</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {galleryUrls.length > 0 ? (
            galleryUrls.slice(0, 8).map((url, index) => (
              <div key={index} className="aspect-square rounded-lg overflow-hidden shadow-md group">
                <img src={url} alt={`Galeri ${index + 1}`} className="w-full h-full object-cover transform group-hover:scale-110 transition duration-500" />
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 col-span-4">Belum ada foto di galeri. Silakan upload melalui CPanel.</p>
          )}
        </div>
        {galleryUrls.length > 0 && (
          <div className="text-center mt-8">
            <Link href="/gallery" className="text-blue-600 font-semibold hover:underline flex items-center justify-center gap-1 transition duration-300 hover:text-blue-700">
              Lihat Semua Galeri <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
          </div>
        )}
      </section>

      {/* === TESTIMONIALS SECTION (BARU) === */}
      <section id="testimonials" className="bg-gray-50 py-20"> {/* Diubah menjadi soft bg-gray-50 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-800">Apa Kata Pelanggan Kami?</h2>
          {testimonials.length > 0 ? (
              <TestimonialSlider testimonials={testimonials} />
          ) : (
              <p className="text-center text-gray-500">Testimonial belum tersedia.</p>
          )}
        </div>
      </section>
      {/* === END TESTIMONIALS SECTION === */}

      {/* === FAQ SECTION (BARU) === */}
      <section id="faq" className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-800">Pertanyaan yang Sering Diajukan (FAQ)</h2>
          {faqs.length > 0 ? (
            <div className="space-y-4">
              {faqs.map(faq => (
                <FAQCard key={faq.id} {...faq} />
              ))}
            </div>
          ) : (
             <p className="text-center text-gray-500">FAQ belum diatur. Segera atur di Hpanel.</p>
          )}
        </div>
      </section>
      {/* === END FAQ SECTION === */}
      
      {/* Contact – sosmed tampil di sini */}
      <section id="contact" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-gray-50">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-800">Tentang Kami & Kontak</h2>
        <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-10 transition duration-300 hover:shadow-2xl">
          <div>
            <h3 className="text-2xl font-bold mb-3 text-blue-600">Tentang {settings.siteName}</h3>
            <p className="text-gray-600 whitespace-pre-line">{settings.aboutText || "Silakan atur teks 'Tentang Kami' di CPanel CMS."}</p>
          </div>
          <div className="space-y-4"> 
            <h3 className="text-2xl font-bold mb-3 text-green-600">Hubungi Kami</h3> 
            <p className="text-lg transition duration-300 hover:text-green-700">
              <i className="fa-solid fa-phone-alt fa-fw mr-3 text-gray-500"></i> 
              <span className="font-semibold">{settings.contactPhone}</span> 
            </p> 
            <p className="text-lg transition duration-300 hover:text-blue-700">
              <i className="fa-solid fa-envelope fa-fw mr-3 text-gray-500"></i> 
              <span className="font-semibold">{settings.contactEmail || 'info@asokatrip.com'}</span> 
            </p> 
            <div className="pt-2">
              <div className="text-sm font-semibold text-slate-700 mb-2">Ikuti kami:</div>
              <div className="flex items-center gap-4">
                <a href={social.instagram || "#"} target={social.instagram ? "_blank" : undefined} rel={social.instagram ? "noopener noreferrer" : undefined} aria-label="Instagram" title={social.instagram ? "Instagram" : "Segera hadir"} className={`transition ${social.instagram ? "text-slate-600 hover:text-pink-600" : "text-slate-400 cursor-not-allowed pointer-events-none opacity-50"}`}>
                  <i className="fa-brands fa-instagram fa-xl"></i>
                </a>
                <a href={social.facebook || "#"} target={social.facebook ? "_blank" : undefined} rel={social.facebook ? "noopener noreferrer" : undefined} aria-label="Facebook" title={social.facebook ? "Facebook" : "Segera hadir"} className={`transition ${social.facebook ? "text-slate-600 hover:text-blue-600" : "text-slate-400 cursor-not-allowed pointer-events-none opacity-50"}`}>
                  <i className="fa-brands fa-facebook fa-xl"></i>
                </a>
                <a href={social.tiktok || "#"} target={social.tiktok ? "_blank" : undefined} rel={social.tiktok ? "noopener noreferrer" : undefined} aria-label="TikTok" title={social.tiktok ? "TikTok" : "Segera hadir"} className={`transition ${social.tiktok ? "text-slate-600 hover:text-slate-900" : "text-slate-400 cursor-not-allowed pointer-events-none opacity-50"}`}>
                  <i className="fa-brands fa-tiktok fa-xl"></i>
                </a>
                <a href={social.youtube || "#"} target={social.youtube ? "_blank" : undefined} rel={social.youtube ? "noopener noreferrer" : undefined} aria-label="YouTube" title={social.youtube ? "YouTube" : "Segera hadir"} className={`transition ${social.youtube ? "text-slate-600 hover:text-red-600" : "text-slate-400 cursor-not-allowed pointer-events-none opacity-50"}`}>
                  <i className="fa-brands fa-youtube fa-xl"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-slate-100 text-slate-700 py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-200 pb-8 mb-8">
            {/* Maps */}
            {(() => {
              const mapSrc = buildMapsEmbedLink(settings || null);
              return mapSrc ? (
                <div className="w-full aspect-[8/3] rounded-xl overflow-hidden shadow-sm bg-slate-200 mx-auto md:mx-0">
                  <iframe
                    src={mapSrc}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    title={`Lokasi ${settings?.siteName || "Perusahaan"}`}
                  />
                </div>
              ) : (
                <div className="w-full aspect-[8/3] rounded-xl bg-slate-200/60 grid place-items-center text-slate-500 mx-auto md:mx-0">
                  Lokasi belum diatur.
                </div>
              );
            })()}

            {/* Address & Brand */}
            <div className="space-y-4 pt-2 md:pt-0">
              {/* Footer logo besar (tetap) */}
              {settings?.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={`${settings.siteName} logo`}
                  className="h-28 md:h-32 w-auto object-contain mb-3"
                />
              ) : null}

              <span className="text-xl font-extrabold text-slate-900 block mb-2">
                {settings?.siteName ?? "Asoka Tour Travel"}
              </span>

              <p className="text-sm text-slate-600">
                <i className="fa-solid fa-location-dot fa-fw mr-2 text-slate-500 align-top"></i>
                <span className="font-semibold text-slate-800">Alamat Kami:</span><br />
                {settings?.contactAddress || "Alamat belum diatur di CPanel."}
              </p>

              {!!settings?.footerDescription && (
                <p className="text-sm text-slate-600 whitespace-pre-line pt-2">
                  {settings.footerDescription}
                </p>
              )}
            </div>
          </div>

          {/* Bottom */}
          {(() => {
            const hasAny =
              !!social.instagram || !!social.facebook || !!social.tiktok || !!social.youtube;

            return (
              <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-3">
                <p className="text-sm text-slate-600 order-2 md:order-1 mt-2 md:mt-0">
                  {settings?.copyrightText ||
                    `© ${new Date().getFullYear()} ${settings?.siteName || "Asoka Trip"}. All rights reserved.`}
                </p>

                {hasAny && (
                  <div className="flex items-center gap-5 order-1 md:order-2">
                    {!!social.instagram && (
                      <a href={social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-slate-500 hover:text-pink-600 transition-colors">
                        <i className="fa-brands fa-instagram fa-xl"></i>
                      </a>
                    )}
                    {!!social.facebook && (
                      <a href={social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-slate-500 hover:text-blue-600 transition-colors">
                        <i className="fa-brands fa-facebook fa-xl"></i>
                      </a>
                    )}
                    {!!social.tiktok && (
                      <a href={social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-slate-500 hover:text-slate-900 transition-colors">
                        <i className="fa-brands fa-tiktok fa-xl"></i>
                      </a>
                    )}
                    {!!social.youtube && (
                      <a href={social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-slate-500 hover:text-red-600 transition-colors">
                        <i className="fa-brands fa-youtube fa-xl"></i>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </footer>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.8s ease-out both; }
        .delay-200 { animation-delay: 0.2s; }
      `}</style>
    </div>
  );
}
