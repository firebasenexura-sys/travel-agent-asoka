// Ini adalah file BARU: app/admin/dashboard/cms/landing-page/page.tsx
// Halaman form untuk mengedit konten utama landing page (DITAMBAH SLIDER INPUT)
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// --- PATH IMPORT DIPASTIKAN BENAR ---
import { auth, db, storage } from "@lib/firebase/config"; // <-- 5x ../
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"; // <-- Import Storage functions

// --- Komponen Toast & Loader (Sama) ---
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error' | 'info'; onDone: () => void; }) {
  useEffect(() => { const timer = setTimeout(onDone, 3000); return () => clearTimeout(timer); }, [onDone]);
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

// --- Tipe Data untuk File Baru ---
interface NewImageData {
    file: File;
    previewUrl: string; // Object URL (blob:)
}


// === Halaman Edit Landing Page ===
export default function EditLandingPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // === State untuk semua field CMS ===
  const [siteName, setSiteName] = useState("Asoka Trip");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  // Slider Images (BARU)
  const [sliderFiles, setSliderFiles] = useState<NewImageData[]>([]); // File BARU
  const [sliderPreviews, setSliderPreviews] = useState<string[]>([]); // URL lama (https) + URL baru (blob)
  const [currentSliderUrls, setCurrentSliderUrls] = useState<string[]>([]); // URL lama dari DB (https)

  // Sosmed, Kontak, About (Sama)
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [aboutText, setAboutText] = useState("");

  // Referensi ke dokumen Firestore
  const settingsDocRef = doc(db, "settings", "landingPage");

  // --- Cek Auth & Ambil Data Awal ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUID(user.uid);
        fetchSettings();
      } else {
        router.push("/admin");
      }
    });

    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSiteName(data.siteName || "Asoka Trip");
          setHeroTitle(data.heroTitle || "");
          setHeroSubtitle(data.heroSubtitle || "");
          setLogoPreview(data.logoUrl || null);
          setCurrentLogoUrl(data.logoUrl || null);
          // Ambil data Slider BARU
          setSliderPreviews(data.heroImages || []); // Preview awal = URL lama
          setCurrentSliderUrls(data.heroImages || []); // Simpan URL lama
          setSocialInstagram(data.socialInstagram || "");
          setSocialFacebook(data.socialFacebook || "");
          setSocialTiktok(data.socialTiktok || "");
          setContactAddress(data.contactAddress || "");
          setContactPhone(data.contactPhone || "");
          setContactEmail(data.contactEmail || "");
          setAboutText(data.aboutText || "");
        } else {
          setSiteName("Asoka Trip");
        }
      } catch (error) {
        console.error("Gagal mengambil data CMS:", error);
        setToast({ msg: "Gagal memuat data CMS.", type: "error" });
      } finally {
        setIsLoading(false);
      }
    };

    return () => unsubscribeAuth();
  }, [router]);


  // --- Fungsi Handle Upload Logo (Sama) ---
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // Limit 1MB untuk logo
        setToast({ msg: "Ukuran logo maksimal 1 MB.", type: "error" });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // --- Fungsi Handle Upload Slider (BARU) ---
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
        const fileList = Array.from(files);
        const currentCount = sliderPreviews.filter(url => url.startsWith('https://')).length + sliderFiles.length; // Hitung URL lama + file baru
        const availableSlots = 5 - currentCount; // Maksimal 5 foto slider

        if (fileList.length > availableSlots) {
           setToast({ msg: `Maksimal ${availableSlots} foto lagi (total maks 5).`, type: "error" });
        }
        
        const filesToAdd = fileList.slice(0, availableSlots);
        const addedImageData: NewImageData[] = [];
        const addedPreviews: string[] = [];

        for (const file of filesToAdd) {
             if (file.size > 2 * 1024 * 1024) { // Limit 2MB
                 setToast({ msg: `File "${file.name}" terlalu besar (maks 2 MB).`, type: "error" });
                 continue;
             }
             const previewUrl = URL.createObjectURL(file);
             addedImageData.push({ file, previewUrl });
             addedPreviews.push(previewUrl);
        }

        // Update state
        setSliderFiles(prev => [...prev, ...addedImageData]);
        setSliderPreviews(prev => [...prev, ...addedPreviews]);
        
        e.target.value = ''; // Reset input file
    }
  };
  
  // --- Fungsi Hapus Preview Slider (BARU) ---
  const removeSliderImage = (indexToRemove: number) => {
    const urlToRemove = sliderPreviews[indexToRemove];
    const updatedPreviews = sliderPreviews.filter((_, i) => i !== indexToRemove);
    setSliderPreviews(updatedPreviews); 

    // Jika URL adalah blob (file baru)
    if (urlToRemove.startsWith('blob:')) {
      const updatedNewImageData = sliderFiles.filter(item => item.previewUrl !== urlToRemove);
      setSliderFiles(updatedNewImageData);
       try { URL.revokeObjectURL(urlToRemove); } catch (e) { console.warn("Could not revoke blob URL:", e); }
    }
    // Jika URL adalah https (file lama), biarkan dulu. Penghapusan terjadi saat Save.
  };
  


  // --- Fungsi Simpan Data CMS (Ditambah Slider) ---
  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID) { setToast({ msg: "Error: User tidak terautentikasi.", type: "error" }); return; }
    if (!siteName.trim()) { setToast({ msg: "Nama Website wajib diisi.", type: "error" }); return; }
    setIsSaving(true);
    setToast(null);

    try {
      let finalLogoUrl = currentLogoUrl || "";
      let finalSliderUrls: string[] = [];

      // 1. Upload Logo Baru (jika ada file dipilih)
      if (logoFile) {
        if (currentLogoUrl) { try { await deleteObject(ref(storage, currentLogoUrl)); } catch (deleteError: any) { if (deleteError.code !== 'storage/object-not-found') console.warn("Gagal hapus logo lama:", deleteError); } }
        const logoFileName = `${userUID}_logo_${Date.now()}_${logoFile.name}`;
        const logoStorageRef = ref(storage, `settings/${logoFileName}`);
        const uploadTask = await uploadBytes(logoStorageRef, logoFile);
        finalLogoUrl = await getDownloadURL(uploadTask.ref);
        setCurrentLogoUrl(finalLogoUrl); setLogoFile(null);
      }

      // 2. Upload Gambar Slider BARU (BARU)
      const existingSliderUrls = sliderPreviews.filter(url => url.startsWith('https://')); // URL lama yg tersisa di preview
      const filesToUpload = sliderFiles.filter(item => sliderPreviews.includes(item.previewUrl)); // File baru yg masih ada di preview
      
      if (filesToUpload.length > 0) {
        setToast({ msg: `Mengupload ${filesToUpload.length} gambar slider...`, type: "info"});
        const uploadPromises = filesToUpload.map(async (item) => {
          const fileName = `${userUID}_hero_${Date.now()}_${item.file.name}`;
          const storageRef = ref(storage, `settings/hero_slider/${fileName}`); // Folder khusus slider
          const uploadTask = await uploadBytes(storageRef, item.file);
          return await getDownloadURL(uploadTask.ref);
        });
        const newUploadedUrls = await Promise.all(uploadPromises);
        finalSliderUrls = [...existingSliderUrls, ...newUploadedUrls]; // Gabungkan
      } else {
         finalSliderUrls = existingSliderUrls;
      }
      
      // 3. Hapus gambar slider LAMA di storage yang TIDAK ADA di finalSliderUrls
      const urlsToDelete = currentSliderUrls.filter(url => !finalSliderUrls.includes(url));
      if (urlsToDelete.length > 0) {
         console.log("Menghapus slider lama:", urlsToDelete);
         const deletePromises = urlsToDelete.map(async (url) => {
           try { await deleteObject(ref(storage, url)); }
           catch (err:any) { if (err.code !== 'storage/object-not-found') console.warn("Gagal hapus slider lama:", err); }
         });
         await Promise.all(deletePromises);
      }
      setCurrentSliderUrls(finalSliderUrls); // Update URL lama
      setSliderFiles([]); // Reset file input

      // 4. Siapkan Data untuk Disimpan ke Firestore
      const dataToSave = {
        siteName: siteName.trim(), 
        heroTitle, heroSubtitle,
        logoUrl: finalLogoUrl,
        heroImages: finalSliderUrls, // <-- SIMPAN ARRAY SLIDER FINAL
        socialInstagram, socialFacebook, socialTiktok,
        contactAddress, contactPhone, contactEmail,
        aboutText,
        updatedAt: serverTimestamp(),
      };

      // 5. Simpan ke Firestore
      await setDoc(settingsDocRef, dataToSave, { merge: true });
      setToast({ msg: "Pengaturan Landing Page berhasil disimpan!", type: "success" });

    } catch (error: any) {
      console.error("Gagal menyimpan data CMS:", error);
      setToast({ msg: `Gagal menyimpan data CMS: ${error.message}`, type: "error" });
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
         <div className="flex items-center gap-4"> <Link href="/dashboard/cms"> <span className="text-gray-500 hover:text-blue-600 cursor-pointer"> <i className="fas fa-arrow-left mr-2"></i>Kembali </span> </Link> <h2 className="text-2xl font-bold text-gray-800">Edit Landing Page</h2> </div>
      </div>

      {/* Form Utama */}
      <form onSubmit={handleSaveCms} className="space-y-8">

        {/* --- Section Pengaturan Umum (Sama) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            <i className="fas fa-cog mr-2 text-gray-500"></i> Pengaturan Umum
          </h3>
          <div>
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">Nama Website (Header)</label>
            <input id="siteName" type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Nama website Anda"/>
          </div>
        </div>


        {/* --- Section Hero & Header Logo (Diperbarui) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            <i className="fas fa-pager mr-2 text-indigo-500"></i> Section Hero & Header Logo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Hero Text */}
            <div className="space-y-4">
               <div> <label htmlFor="heroTitle" className="block text-sm font-medium text-gray-700 mb-1">Judul Hero</label> <input id="heroTitle" type="text" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" /> </div>
               <div> <label htmlFor="heroSubtitle" className="block text-sm font-medium text-gray-700 mb-1">Sub-Judul Hero</label> <input id="heroSubtitle" type="text" value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" /> </div>
            </div>
            {/* Input Logo */}
            <div className="space-y-2">
               <label className="block text-sm font-medium text-gray-700 mb-1">Logo Header (Maks 1MB)</label>
               {logoPreview ? ( <img src={logoPreview} alt="Logo preview" className="h-16 w-auto object-contain border border-gray-200 rounded-lg p-1 bg-gray-50 mb-2"/> ) : ( <div className="h-16 w-40 flex items-center justify-center border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 mb-2">Logo Preview</div> )}
               <input id="logoFile" type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleLogoChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            </div>
          </div>
          
           {/* Slider Hero Images (BARU SECTION) */}
          <div className="mt-8 pt-4 border-t border-gray-200">
             <h4 className="text-lg font-semibold text-gray-800 mb-3">
                 <i className="fas fa-images mr-2 text-red-500"></i> Gambar Slider Hero (Maks 5 Foto)
             </h4>
             <div className="space-y-2">
                 <div className="grid grid-cols-5 gap-3">
                    {/* Preview dan Tombol Hapus */}
                    {sliderPreviews.map((url, index) => (
                       <div key={url} className="relative aspect-video rounded-lg overflow-hidden group">
                           <img src={url} alt={`Slider ${index}`} className="w-full h-full object-cover" />
                           <button type="button" onClick={() => removeSliderImage(index)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow">
                               &times;
                           </button>
                       </div>
                    ))}
                    {/* Placeholder Input */}
                    {sliderPreviews.length < 5 && (
                       <label htmlFor="sliderImages" className="cursor-pointer aspect-video flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-500 transition">
                           <i className="fas fa-plus fa-lg"></i>
                       </label>
                    )}
                 </div>
                 <input id="sliderImages" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleSliderChange} disabled={sliderPreviews.length >= 5} className="hidden"/>
             </div>
          </div>
        </div>

        {/* --- Section Sosial Media (Sama) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
           {/* ... kode sosmed sama ... */}
             <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4"> <i className="fas fa-share-alt mr-2 text-green-500"></i> Sosial Media </h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div> <label htmlFor="socialInstagram" className="block text-sm font-medium text-gray-700 mb-1">URL Instagram</label> <input id="socialInstagram" type="url" value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="https://instagram.com/..."/> </div>
                <div> <label htmlFor="socialFacebook" className="block text-sm font-medium text-gray-700 mb-1">URL Facebook</label> <input id="socialFacebook" type="url" value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="https://facebook.com/..."/> </div>
                <div> <label htmlFor="socialTiktok" className="block text-sm font-medium text-gray-700 mb-1">URL TikTok</label> <input id="socialTiktok" type="url" value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="https://tiktok.com/@..."/> </div>
            </div>
        </div>

        {/* --- Section Kontak (Sama) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
           {/* ... kode kontak sama ... */}
           <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4"> <i className="fas fa-address-card mr-2 text-purple-500"></i> Informasi Kontak </h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div> <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">No. Telepon/WA</label> <input id="contactPhone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="+62..."/> </div>
              <div> <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">Alamat Email</label> <input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="info@..."/> </div>
              <div className="md:col-span-3"> <label htmlFor="contactAddress" className="block text-sm font-medium text-gray-700 mb-1">Alamat Kantor/Lokasi</label> <textarea id="contactAddress" value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} rows={3} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="Alamat lengkap..."></textarea> </div>
           </div>
        </div>

        {/* --- Section Tentang Kami (Sama) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
           {/* ... kode about sama ... */}
           <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4"> <i className="fas fa-info-circle mr-2 text-yellow-500"></i> Tentang Kami (About Us) </h3>
           <div> <label htmlFor="aboutText" className="block text-sm font-medium text-gray-700 mb-1">Teks Tentang Kami</label> <textarea id="aboutText" value={aboutText} onChange={(e) => setAboutText(e.target.value)} rows={6} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="Jelaskan tentang Asoka Trip..."></textarea> </div>
        </div>

        {/* Tombol Simpan (Sticky) */}
        <div className="sticky bottom-0 -mx-8 -mb-8 mt-8 px-8 py-4 bg-gray-100/80 backdrop-blur-sm border-t border-gray-200 flex justify-end">
           <button type="submit" disabled={isSaving || isLoading} className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"> {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} Simpan Perubahan </button>
        </div>

      </form>
    </>
  );
}
