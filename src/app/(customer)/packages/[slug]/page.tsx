// Ini adalah file: app/packages/[slug]/page.tsx
// Halaman Detail Paket Trip untuk Tamu
"use client";

import { useState, useEffect, useRef, type ReactNode, CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation"; // Untuk mengambil slug dari URL
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { auth, db, storage } from "@lib/firebase/config";
import { Plus_Jakarta_Sans } from "next/font/google"; // Import font untuk tampilan profesional

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400","600","700","800"] }); // Inisialisasi font

/* ===========================
 * Types (Sama)
 * =========================== */
interface Package {
  id: string; name: string; category: string; price: number; unit: string;
  buttonText: string; description: string; imageUrls: string[]; duration?: string;
  location?: string; features?: string[]; exclusions?: string; itinerary?: string;
  terms?: string; youtubeUrl?: string; minPax?: number; maxPax?: number; slug?: string;
  rating?: number; reviewsCount?: number;
}
interface SiteSettings { contactPhone: string; }

/* ===========================
 * Utils (Sama)
 * =========================== */
const formatCurrency = (amount: number | undefined) => { /* ... kode sama ... */
    if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
};

const extractYouTubeEmbed = (url?: string | null) => {
  if (!url) return null;
  const id = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|\w+\/|embed\/|v\/)|youtu\.be\/)([^#\&\?]*)/)?.[1];
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
};

/* ===========================
 * Micro components
 * =========================== */

/** Reveal component: efek masuk lembut saat scroll */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.style.transitionDelay = `${delay}ms`;
            el.classList.remove("opacity-0", "translate-y-4");
            el.classList.add("opacity-100", "translate-y-0");
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-4 transition-all duration-700 ${className}`}
    >
      {children}
    </div>
  );
}

/** Divider */
const Divider = () => (
  <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
);

/** Helper Detail Item */
function DetailItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start text-gray-700 py-1">
      <i className={`fas ${icon} fa-fw mr-3 mt-1 text-blue-600/90`}></i>
      <span className="font-semibold mr-2">{label}:</span>
      <span className="flex-grow">{value}</span>
    </div>
  );
}

/** Chip Status */
function Chip({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-blue-400/50 bg-blue-100/30 px-3 py-1 text-xs font-medium text-blue-800 backdrop-blur ${className}`}>
      {children}
    </span>
  );
}

/* ===========================
 * Page
 * =========================== */
export default function PackageDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [pkg, setPkg] = useState<Package | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [tab, setTab] = useState<"overview" | "itinerary" | "gallery" | "terms">("overview");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false); // State untuk Lightbox

  // --- Ambil Data Paket Berdasarkan Slug/ID ---
  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      setLoading(true);
      setNotFound(false);

      try {
        // Fetch Settings (untuk nomor WA)
        const settingsSnap = await getDoc(doc(db, "settings", "landingPage"));
        if (settingsSnap.exists()) setSettings(settingsSnap.data() as SiteSettings);
        
        const packagesRef = collection(db, "packages");
        const snapshot = await getDocs(
          query(packagesRef, where("slug", "==", slug), limit(1)) // Coba cari berdasarkan slug
        );

        if (snapshot.empty) {
          // Fallback: Coba cari berdasarkan ID dokumen (jika tidak ditemukan berdasarkan slug)
          const docSnap = await getDoc(doc(db, "packages", slug));
          if (docSnap.exists()) setPkg({ id: docSnap.id, ...(docSnap.data() as any) } as Package);
          else setNotFound(true);
        } else {
          const d = snapshot.docs[0];
          setPkg({ id: d.id, ...(d.data() as any) } as Package);
        }
      } catch (e) {
        console.error("Error fetching package details:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchData();
  }, [slug]);

  const waLink = (message: string) => {
    const phone = (settings?.contactPhone || "+628123456789").replace(/\D/g, "");
    const normalized = phone.startsWith("62") ? phone : "62" + phone.substring(1);
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  };

  const nextImg = () =>
    setCurrentImageIndex((i) => (!pkg?.imageUrls?.length ? i : (i + 1) % pkg.imageUrls.length));
  const prevImg = () =>
    setCurrentImageIndex((i) =>
      !pkg?.imageUrls?.length ? i : (i - 1 + pkg.imageUrls.length) % pkg.imageUrls.length
    );

  const embedUrl = extractYouTubeEmbed(pkg?.youtubeUrl);

  if (loading) {
    return (
      <div className={`${jakarta.className} min-h-[70vh] grid place-items-center bg-gray-50`}>
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 animate-ping rounded-full bg-blue-600" />
          <span className="text-gray-600">Memuat detail paket…</span>
        </div>
      </div>
    );
  }
  if (notFound || !pkg) {
    return (
      <div className={`${jakarta.className} min-h-[70vh] grid place-items-center`}>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-800 mb-2">Paket tidak ditemukan</p>
          <p className="text-gray-500 mb-6">Coba kembali ke beranda.</p>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            <i className="fas fa-arrow-left"></i> Beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${jakarta.className} min-h-screen bg-gray-50`}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Perbaikan: Hilangkan focus:ring dari Link Kembali */}
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-2 focus:outline-none rounded-lg p-1 -m-1 transition-colors hover:bg-gray-100">
            <i className="fas fa-chevron-left"></i>
            Kembali
          </Link>
          <a
            href={waLink(`Halo, saya tertarik dengan paket: ${pkg.name}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-2 rounded-full bg-green-500 px-4 py-2 text-white transition hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <span className="absolute inset-0 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition" />
            <i className="fab fa-whatsapp"></i>
            Chat untuk Booking
          </a>
        </div>
      </header>

      {/* Hero Header & Galeri Utama */}
      <section className="bg-white pb-6 border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          
          {/* Tag & Rating (Top Section) */}
          <Reveal>
            <div className="flex flex-wrap items-center justify-between gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip className="bg-blue-50 border-blue-300 text-blue-700"><i className="fas fa-tag mr-1"></i>{pkg.category.replace(/-/g, ' ')}</Chip>
                {pkg.duration && <Chip className="bg-blue-50 border-blue-300 text-blue-700"><i className="fas fa-clock mr-1"></i>{pkg.duration}</Chip>}
                {pkg.location && <Chip className="bg-blue-50 border-blue-300 text-blue-700"><i className="fas fa-map-marker-alt mr-1"></i>{pkg.location}</Chip>}
              </div>
              {(pkg.rating || pkg.reviewsCount) && (
                <div className="text-sm text-gray-600">
                  <i className="fas fa-star text-yellow-500"></i>{" "}
                  {pkg.rating ?? 4.9} • {pkg.reviewsCount ?? 120} ulasan
                </div>
              )}
            </div>
          </Reveal>

          {/* Judul & Harga */}
          <Reveal delay={80}>
            <div className="border-b border-gray-100 pb-3">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
                {pkg.name}
              </h1>
              <div className="mt-2 flex items-baseline gap-4">
                <span className="text-xl md:text-3xl font-bold text-green-600">
                  {pkg.price > 0 ? formatCurrency(pkg.price) : "Harga Terbaik"}
                </span>
                <span className="ml-1 text-sm md:text-base text-gray-500">{pkg.unit}</span>
              </div>
            </div>
          </Reveal>
          
          {/* Hero Media — Galeri Slider */}
          <Reveal delay={160} className="w-full">
            <div className="mt-6 rounded-xl border border-gray-100 shadow-xl transition-all duration-300">
              <div className="overflow-hidden rounded-xl">
                <div className="relative aspect-video bg-black/10">
                  {pkg.imageUrls?.length ? (
                    <>
                      <img
                        src={pkg.imageUrls[currentImageIndex]}
                        alt={pkg.name}
                        className="h-full w-full object-cover transition-opacity duration-500"
                        onClick={() => setLightboxOpen(true)}
                        style={{ cursor: 'zoom-in' }}
                      />
                      {pkg.imageUrls.length > 1 && (
                        <>
                          {/* Perbaikan: Target focus ring yang lebih jelas */}
                          <button
                            onClick={(e) => { e.stopPropagation(); prevImg(); }}
                            aria-label="Sebelumnya"
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                          >
                            <i className="fas fa-chevron-left"></i>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); nextImg(); }}
                            aria-label="Selanjutnya"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                          >
                            <i className="fas fa-chevron-right"></i>
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                            {currentImageIndex + 1} / {pkg.imageUrls.length}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="grid h-full place-items-center text-gray-500">
                      Foto belum tersedia
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 -mt-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Tabs & Main Content */}
          <div className="lg:col-span-2">
            <div className="sticky top-[56px] z-20 bg-gray-50/90 backdrop-blur pt-4 mb-4">
              <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
                {(["overview", "itinerary", "gallery", "terms"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    // Perbaikan: Focus ring yang lebih halus
                    className={`px-3 md:px-4 py-1.5 md:py-2 text-sm rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2 ${ 
                      tab === t ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    aria-pressed={tab === t}
                  >
                    {t === "overview" && "Ringkasan"}
                    {t === "itinerary" && "Itinerary"}
                    {t === "gallery" && "Galeri"}
                    {t === "terms" && "S&K"}
                  </button>
                ))}
              </div>
              <Divider />
            </div>

            {/* --- Konten Tab --- */}
            <div className="space-y-6">

                {/* TAB: RINGKASAN */}
                {tab === "overview" && (
                  <section className="space-y-5">
                    <Reveal>
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <h3 className="text-lg md:text-xl font-bold mb-3">Deskripsi Paket</h3>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                          {pkg.description}
                        </p>
                      </div>
                    </Reveal>
    
                    {/* Termasuk */}
                    {!!pkg.features?.length && (
                      <Reveal delay={80}>
                        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                          <h4 className="text-base md:text-lg font-bold mb-3">Termasuk Dalam Paket</h4>
                          <ul className="grid sm:grid-cols-2 gap-3 list-disc pl-5">
                            {pkg.features.map((f, i) => (
                              <li key={i} className="text-gray-700">
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Reveal>
                    )}
                    
                    {/* Tidak Termasuk */}
                     {pkg.exclusions && (
                      <Reveal delay={120}>
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                          <h4 className="text-base md:text-lg font-bold mb-3 text-red-700">Tidak Termasuk</h4>
                          <pre className="whitespace-pre-wrap text-red-800 leading-relaxed text-sm">
                            {pkg.exclusions}
                          </pre>
                        </div>
                      </Reveal>
                    )}
                  </section>
                )}

                {/* TAB: ITINERARY */}
                {tab === "itinerary" && pkg.itinerary && (
                  <section className="mt-5">
                    <Reveal>
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <h3 className="text-lg md:text-xl font-bold mb-3">Rencana Perjalanan</h3>
                        <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                          {pkg.itinerary}
                        </pre>
                      </div>
                    </Reveal>
                  </section>
                )}

                {/* TAB: GALERI */}
                {tab === "gallery" && (
                  <section className="mt-5">
                    <Reveal>
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <h3 className="text-lg md:text-xl font-bold mb-3">Semua Foto Paket Ini</h3>
                        {pkg.imageUrls?.length ? (
                          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                            {pkg.imageUrls.map((src, i) => (
                              <button
                                key={i}
                                onClick={() => { setCurrentImageIndex(i); setLightboxOpen(true); }}
                                className="group relative aspect-square overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                              >
                                <img
                                  src={src}
                                  alt={`${pkg.name} ${i + 1}`}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                />
                                <span className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600">Belum ada foto yang diupload.</p>
                        )}
                      </div>
                    </Reveal>
                  </section>
                )}

                {/* TAB: S&K */}
                {tab === "terms" && (
                  <section className="mt-5">
                    <Reveal>
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <h3 className="text-lg md:text-xl font-bold mb-3">Syarat & Ketentuan</h3>
                        {pkg.terms ? (
                            <p className="whitespace-pre-line text-gray-700">{pkg.terms}</p>
                        ) : (
                            <p className="text-gray-600 italic">Syarat dan ketentuan belum diisi.</p>
                        )}
                      </div>
                    </Reveal>
                    
                    {/* Tambahan: YouTube di bawah S&K */}
                    {embedUrl && (
                      <Reveal delay={80}>
                        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h4 className="text-base md:text-lg font-bold mb-3">Video Highlight</h4>
                            <div className="aspect-video overflow-hidden rounded-lg">
                              <iframe
                                src={embedUrl}
                                className="h-full w-full"
                                title={`Video ${pkg.name}`}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                            </div>
                        </div>
                      </Reveal>
                    )}
                  </section>
                )}
            </div>
          </div>

          {/* Right: Sticky Booking Card */}
          <aside className="lg:col-span-1">
            <Reveal delay={120}>
              <div className="lg:sticky lg:top-[84px] rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
                <div className="mb-3">
                  <div className="text-gray-500 text-xs">Mulai dari</div>
                  <div className="text-xl md:text-2xl font-extrabold text-gray-900">
                    {pkg.price > 0 ? formatCurrency(pkg.price) : "Harga Terbaik"}
                    <span className="ml-1 text-xs md:text-sm font-normal text-gray-500">{pkg.unit}</span>
                  </div>
                </div>
                <a
                  href={waLink(`Halo, saya tertarik dengan paket: ${pkg.name}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-green-500 px-4 py-3 text-white transition hover:bg-green-600 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  <span className="absolute inset-0 rounded-xl ring-1 ring-white/20 group-hover:ring-white/40 transition" />
                  <i className="fab fa-whatsapp fa-lg"></i>
                  Pesan via WhatsApp
                </a>
                <div className="mt-3 text-xs text-gray-500">
                  <i className="fas fa-shield-alt text-green-600"></i>{" "}
                  Pembayaran aman • Support 24/7
                </div>
                <Divider />
                <div className="space-y-1 text-sm text-gray-700">
                  <DetailItem icon="fa-check" label="Konfirmasi cepat" value="Admin responsif" />
                  <DetailItem icon="fa-check" label="Penyesuaian" value="Itinerary fleksibel" />
                  <DetailItem icon="fa-check" label="Dokumentasi" value="Opsional (tambahan biaya)" />
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxOpen && pkg.imageUrls?.length ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
            aria-label="Tutup"
            onClick={() => setLightboxOpen(false)}
          >
            <i className="fas fa-times"></i>
          </button>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
            onClick={(e) => { e.stopPropagation(); prevImg(); }}
            aria-label="Sebelumnya"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <img
            src={pkg.imageUrls[currentImageIndex]}
            alt={`${pkg.name} - ${currentImageIndex + 1}`}
            className="max-h-[78vh] w-auto rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
            onClick={(e) => { e.stopPropagation(); nextImg(); }}
            aria-label="Selanjutnya"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {currentImageIndex + 1} / {pkg.imageUrls.length}
          </div>
        </div>
      ) : null}
    </div>
  );
}
