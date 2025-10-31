// Ini adalah file BARU: app/admin/dashboard/cms/footer/page.tsx
// Halaman untuk mengelola konten footer
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

// --- Komponen Toast & Loader (Sama) ---
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void; }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);
  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  return ( <div className={`fixed top-5 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-lg text-white ${bgColor} z-50`}>{message}</div> );
}
function Loader({ text = "Memuat..." }: { text?: string; }) {
  return (
    <div className="fixed inset-0 bg-white/80 z-[60] flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-700 font-semibold">{text}</p>
      </div>
    </div>
  );
}
// --- END Komponen ---


// === Halaman Edit Footer ===
export default function EditFooterPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading data awal
  const [isSaving, setIsSaving] = useState(false); // Loading saat simpan
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk field Footer ===
  const [copyrightText, setCopyrightText] = useState("");
  const [footerDescription, setFooterDescription] = useState("");
  // Lokasi
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [googleMapsLink, setGoogleMapsLink] = useState("");
  
  // Footer Social Media Links
  const [footerSocialInstagram, setFooterSocialInstagram] = useState("");
  const [footerSocialFacebook, setFooterSocialFacebook] = useState("");
  const [footerSocialTiktok, setFooterSocialTiktok] = useState("");
  const [footerSocialYoutube, setFooterSocialYoutube] = useState(""); 

  // Referensi ke dokumen Firestore
  const settingsDocRef = doc(db, "settings", "landingPage");

  // --- Cek Auth & Ambil Data Awal ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUID(user.uid);
        fetchFooterSettings(); // Panggil fetch setelah user login
      } else {
        router.push("/admin"); // Tendang jika tidak login
      }
    });

    const fetchFooterSettings = async () => {
      setIsLoading(true);
      try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Konten Dasar
          setCopyrightText(data.copyrightText || `© ${new Date().getFullYear()} Asoka Trip. All rights reserved.`);
          setFooterDescription(data.footerDescription || "");
          
          // Lokasi
          setLatitude(data.latitude || "");
          setLongitude(data.longitude || "");
          setGoogleMapsLink(data.googleMapsLink || "");
          
          // Sosmed Footer
          setFooterSocialInstagram(data.footerSocialInstagram || "");
          setFooterSocialFacebook(data.footerSocialFacebook || "");
          setFooterSocialTiktok(data.footerSocialTiktok || "");
          setFooterSocialYoutube(data.footerSocialYoutube || "");
          
        } else {
          console.log("Dokumen 'settings/landingPage' belum ada.");
          setCopyrightText(`© ${new Date().getFullYear()} Asoka Trip. All rights reserved.`);
          // Set default lainnya
          setFooterDescription(""); setLatitude(""); setLongitude(""); setGoogleMapsLink("");
          setFooterSocialInstagram(""); setFooterSocialFacebook(""); setFooterSocialTiktok(""); setFooterSocialYoutube("");
        }
      } catch (error) {
        console.error("Gagal mengambil data Footer:", error);
        setToast({ msg: "Gagal memuat data Footer.", type: "error" });
      } finally {
        setIsLoading(false);
      }
    };

    return () => unsubscribeAuth();
  }, [router]);


  // --- Fungsi Simpan Data Footer ---
  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID) {
       setToast({ msg: "Error: User tidak terautentikasi.", type: "error" });
       return;
    }
    setIsSaving(true);
    setToast(null);

    const dataToSave = {
      copyrightText: copyrightText,
      footerDescription: footerDescription,
      latitude: latitude,
      longitude: longitude,
      googleMapsLink: googleMapsLink,
      // footerLinkColumns dihapus
      footerSocialInstagram: footerSocialInstagram,
      footerSocialFacebook: footerSocialFacebook,
      footerSocialTiktok: footerSocialTiktok,
      footerSocialYoutube: footerSocialYoutube,
      updatedAt: serverTimestamp(),
    };

    try {
      // Set field yang tidak ada (footerLinkColumns) sebagai 'null' atau hapus dari dataToSave
      // Di sini kita hanya menghapus dari dataToSave agar Firestore tidak menyimpan field tersebut
      await setDoc(settingsDocRef, dataToSave, { merge: true });
      setToast({ msg: "Pengaturan Footer berhasil disimpan!", type: "success" });
    } catch (error: any) {
      console.error("Gagal menyimpan data Footer:", error);
      setToast({ msg: `Gagal menyimpan: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat data..." />}
      {isSaving && <Loader text="Menyimpan..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cms">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali ke Hpanel
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Edit Footer</h2>
        </div>
      </div>

      {/* Form Utama */}
      <form onSubmit={handleSaveFolder} className="space-y-6">

        {/* --- Section Konten Footer (TETAP) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            <i className="fas fa-shoe-prints mr-2 text-gray-500"></i> Konten Footer Dasar
          </h3>
          <div className="space-y-4">
            {/* Copyright Text */}
            <div>
              <label htmlFor="copyrightText" className="block text-sm font-medium text-gray-700 mb-1">Teks Copyright</label>
              <input
                id="copyrightText" type="text" value={copyrightText}
                onChange={(e) => setCopyrightText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm"
                placeholder={`Contoh: © ${new Date().getFullYear()} Nama Perusahaan Anda`}
              />
            </div>
            {/* Deskripsi Singkat Footer */}
            <div>
              <label htmlFor="footerDescription" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat Footer (Opsional)</label>
              <textarea
                id="footerDescription" value={footerDescription}
                onChange={(e) => setFooterDescription(e.target.value)}
                rows={4} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm"
                placeholder="Tulis deskripsi singkat atau tagline untuk footer..."
              />
            </div>
          </div>
        </div>

        {/* --- Section Link Kolom (DIHAPUS) --- */}
        {/* Konten untuk Kolom Link telah dihapus di sini */}


        {/* --- Section Ikon Sosial Media Footer (TETAP) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
           <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            <i className="fas fa-hashtag mr-2 text-pink-500"></i> Link Ikon Sosial Media Footer
           </h3>
           <p className="text-sm text-gray-500 mb-4">
             Masukkan URL lengkap profil sosial media Anda. Ikon akan muncul di footer jika URL diisi.
           </p>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Instagram */}
             <div>
               <label htmlFor="footerSocialInstagram" className="block text-sm font-medium text-gray-700 mb-1"><i className="fab fa-instagram mr-1.5"></i> Instagram</label>
               <input
                 id="footerSocialInstagram" type="url" value={footerSocialInstagram}
                 onChange={(e) => setFooterSocialInstagram(e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="https://instagram.com/..."
               />
             </div>
             {/* Facebook */}
             <div>
               <label htmlFor="footerSocialFacebook" className="block text-sm font-medium text-gray-700 mb-1"><i className="fab fa-facebook mr-1.5"></i> Facebook</label>
               <input
                 id="footerSocialFacebook" type="url" value={footerSocialFacebook}
                 onChange={(e) => setFooterSocialFacebook(e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="https://facebook.com/..."
               />
             </div>
              {/* TikTok */}
             <div>
               <label htmlFor="footerSocialTiktok" className="block text-sm font-medium text-gray-700 mb-1"><i className="fab fa-tiktok mr-1.5"></i> TikTok</label>
               <input
                 id="footerSocialTiktok" type="url" value={footerSocialTiktok}
                 onChange={(e) => setFooterSocialTiktok(e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="https://tiktok.com/@..."
               />
             </div>
             {/* YouTube */}
              <div>
               <label htmlFor="footerSocialYoutube" className="block text-sm font-medium text-gray-700 mb-1"><i className="fab fa-youtube mr-1.5"></i> YouTube</label>
               <input
                 id="footerSocialYoutube" type="url" value={footerSocialYoutube}
                 onChange={(e) => setFooterSocialYoutube(e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="https://youtube.com/..."
               />
             </div>
           </div>
        </div>

        {/* --- Section Lokasi Peta (TETAP) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
           <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            <i className="fas fa-map-marked-alt mr-2 text-red-500"></i> Lokasi Peta Google Maps
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Masukkan koordinat Latitude/Longitude dan link Google Maps untuk lokasi Anda. Anda bisa mendapatkan ini dari Google Maps.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Latitude */}
            <div>
              <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input
                id="latitude"
                type="text" 
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Contoh: -7.33..."
              />
            </div>
            {/* Longitude */}
            <div>
              <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input
                id="longitude"
                type="text" 
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Contoh: 109.91..."
              />
            </div>
            {/* Link Google Maps */}
            <div className="md:col-span-2">
              <label htmlFor="googleMapsLink" className="block text-sm font-medium text-gray-700 mb-1">Link Google Maps</label>
              <input
                id="googleMapsLink"
                type="url"
                value={googleMapsLink}
                onChange={(e) => setGoogleMapsLink(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Contoh: https://maps.app.goo.gl/..."
              />
               <p className="text-xs text-gray-500 mt-1">Salin link dari tombol "Share" di Google Maps.</p>
            </div>
          </div>
        </div>


        {/* Tombol Simpan (Sticky) */}
        <div className="sticky bottom-0 -mx-8 -mb-8 mt-8 px-8 py-4 bg-gray-100/80 backdrop-blur-sm border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            Simpan Pengaturan Footer
          </button>
        </div>

      </form>
    </>
  );
}