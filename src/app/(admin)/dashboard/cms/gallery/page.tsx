// Ini adalah file BARU: app/admin/dashboard/cms/gallery/page.tsx
// Halaman untuk mengelola foto-foto di galeri landing page
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config"; // <-- Path ke config (5x ../)
import { onAuthStateChanged } from "firebase/auth";
// --- UBAH getDoc menjadi onSnapshot ---
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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

// --- Tipe Data untuk Galeri ---
interface GalleryData {
  imageUrls: string[];
  updatedAt?: any; // Timestamp Firestore
}

// --- Tipe Data BARU untuk state file baru ---
interface NewImageData {
    file: File;
    previewUrl: string; // Object URL (blob:)
}

// === Halaman Edit Galeri ===
export default function EditGalleryPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading data awal
  const [isSaving, setIsSaving] = useState(false); // Loading saat simpan
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk Foto Galeri (Struktur Diubah) ===
  const [newImageData, setNewImageData] = useState<NewImageData[]>([]); // Menyimpan {file, previewUrl} untuk file BARU
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); // Hanya URL preview (lama https: + baru blob:)
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]); // URL lama dari DB (https:)

  // Referensi ke dokumen Firestore
  const galleryDocRef = doc(db, "gallery", "main");

  // --- Cek Auth & Ambil Data Awal (Menggunakan onSnapshot) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUID(user.uid);
      } else {
        router.push("/admin");
      }
    });

    let unsubscribeSnapshot = () => {};
    if (userUID) {
      if (imagePreviews.length === 0 && currentImageUrls.length === 0) {
          setIsLoading(true);
      }
      unsubscribeSnapshot = onSnapshot(galleryDocRef, (docSnap) => {
        let firestoreUrls: string[] = [];
        if (docSnap.exists()) {
          const data = docSnap.data() as GalleryData;
          firestoreUrls = data.imageUrls || [];
        } else {
          firestoreUrls = [];
        }
        setCurrentImageUrls(firestoreUrls); // Selalu update data asli dari DB

        // --- Logika Update Preview Diperbaiki ---
        // Saat data Firestore berubah, gabungkan dengan preview file baru (blob:) yg MASIH ADA
        setImagePreviews(prevPreviews => {
            // Ambil preview blob: yang masih ada di state sebelumnya
            const localBlobPreviews = prevPreviews.filter(url => url.startsWith('blob:'));
            // Cari file object yang sesuai untuk blob tsb agar tidak hilang saat data DB update
            const relevantNewImageData = newImageData.filter(item => localBlobPreviews.includes(item.previewUrl));
            // Buat ulang blob preview HANYA dari file object yg relevan
            const relevantBlobPreviews = relevantNewImageData.map(item => item.previewUrl);

            // Gabungkan URL dari Firestore + blob preview yang relevan
            const combined = Array.from(new Set([...firestoreUrls, ...relevantBlobPreviews]));
            console.log("onSnapshot Update Previews:", combined); // Debug log
            return combined.slice(0, 100);
        });
        setIsLoading(false);
      }, (error) => {
        console.error("Gagal mengambil data galeri:", error);
        setToast({ msg: "Gagal memuat data galeri.", type: "error" });
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
      // Cleanup Object URLs saat komponen unmount
      newImageData.forEach(item => URL.revokeObjectURL(item.previewUrl));
    };
  }, [router, userUID]); // Dependency array disederhanakan


  // --- Fungsi Handle Upload Gambar (Diperbaiki) ---
   const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileList = Array.from(files);
      // Hitung slot berdasarkan TOTAL preview (URL lama + file baru yg sudah dipilih + file yg akan ditambah)
      const currentTotalPreviews = imagePreviews.length;
      const availableSlots = 100 - currentTotalPreviews;
      const filesToAdd = fileList.slice(0, availableSlots);

      if (fileList.length > availableSlots) {
         setToast({ msg: `Hanya bisa menambah ${availableSlots} foto lagi (total maks 100).`, type: "error" });
      }

      // Validasi ukuran & Buat data baru
      const addedImageData: NewImageData[] = [];
      const addedPreviews: string[] = [];
      for (const file of filesToAdd) {
        if (file.size > 2 * 1024 * 1024) {
          setToast({ msg: `File "${file.name}" terlalu besar (maks 2 MB).`, type: "error" });
          continue; // Lewati file ini, lanjutkan ke file berikutnya
        }
        const previewUrl = URL.createObjectURL(file);
        addedImageData.push({ file, previewUrl });
        addedPreviews.push(previewUrl);
      }

      // Update state
      setNewImageData(prev => [...prev, ...addedImageData]); // Tambahkan data file baru
      setImagePreviews(prev => [...prev, ...addedPreviews]); // Tambahkan preview baru

      e.target.value = ''; // Reset input file
    }
  };


  // --- Fungsi Hapus Preview Foto (Diperbaiki) ---
   const removeImage = useCallback((indexToRemove: number) => {
    const urlToRemove = imagePreviews[indexToRemove];
    const updatedPreviews = imagePreviews.filter((_, i) => i !== indexToRemove);
    setImagePreviews(updatedPreviews); // Update preview

    // Jika URL yang dihapus adalah Object URL (file baru)
    if (urlToRemove.startsWith('blob:')) {
      // Hapus data file dari state newImageData
      const updatedNewImageData = newImageData.filter(item => item.previewUrl !== urlToRemove);
      setNewImageData(updatedNewImageData);
      // Revoke Object URL
       try {
           URL.revokeObjectURL(urlToRemove);
           console.log("Blob URL revoked:", urlToRemove);
       } catch (e) { console.warn("Could not revoke blob URL:", urlToRemove, e); }
    }
    // Jika itu URL lama (https://...), biarkan dulu. Penghapusan terjadi saat Simpan.

  }, [imagePreviews, newImageData]); // Dependensi state diubah


  // --- Fungsi Simpan Galeri (Diperbaiki) ---
  const handleSaveGallery = async () => {
    console.log("Memulai handleSaveGallery...");
    if (!userUID) { setToast({ msg: "Error: User tidak terautentikasi.", type: "error" }); return; }
    setIsSaving(true);
    setToast(null);

    try {
      // 1. Identifikasi URL lama (https:) yang MASIH ADA di preview
      const existingUrlsInPreview = imagePreviews.filter(url => url.startsWith('https://'));
      console.log("URL lama yang masih ada:", existingUrlsInPreview);

      // 2. File BARU yang perlu diupload adalah semua file di state `newImageData`
      const filesToUpload = newImageData.map(item => item.file);
      console.log(`Jumlah file baru untuk diupload: ${filesToUpload.length}`, filesToUpload.map(f => f.name));

      // 3. Upload File BARU
      let newUploadedUrls: string[] = [];
      if (filesToUpload.length > 0) {
        setToast({ msg: `Mengupload ${filesToUpload.length} foto baru...`, type: "success"});
        console.log("Memulai upload...");
        const uploadPromises = filesToUpload.map(async (file, index) => {
          const fileName = `${userUID}_gallery_${Date.now()}_${index}_${file.name}`;
          const storageRef = ref(storage, `gallery/${fileName}`);
          console.log(`Uploading ${file.name} ke path: gallery/${fileName}`);
          try {
              const uploadTask = await uploadBytes(storageRef, file);
              const downloadUrl = await getDownloadURL(uploadTask.ref);
              console.log(`Upload ${file.name} BERHASIL, URL:`, downloadUrl);
              return downloadUrl;
          } catch (uploadError: any) { // Tangkap error spesifik
              console.error(`Upload ${file.name} GAGAL:`, uploadError);
              throw new Error(`Gagal upload ${file.name}: ${uploadError.message || uploadError.code}`); // Beri pesan error jelas
          }
        });
        newUploadedUrls = await Promise.all(uploadPromises); // Jika ada error di sini, akan masuk ke catch bawah
        console.log("Semua upload baru selesai. URL baru:", newUploadedUrls);
      } else {
        console.log("Tidak ada file baru untuk diupload.");
      }

      // 4. Gabungkan URL lama yang tersisa + URL baru
      const finalImageUrls = [...existingUrlsInPreview, ...newUploadedUrls];
      console.log("URL final yang akan disimpan:", finalImageUrls);

      // 5. Hapus gambar lama di storage yang TIDAK ADA di `finalImageUrls`
      //    Gunakan state `currentImageUrls` (data asli dari DB sebelum edit)
      const urlsToDelete = currentImageUrls.filter(url => !finalImageUrls.includes(url));
      if (urlsToDelete.length > 0) {
         console.log("Akan menghapus gambar lama dari Storage:", urlsToDelete);
         const deletePromises = urlsToDelete.map(async (url) => {
           try {
             const oldImageRef = ref(storage, url);
             await deleteObject(oldImageRef);
             console.log("Gambar lama dihapus:", url);
           }
           catch (err:any) {
               if (err.code !== 'storage/object-not-found') console.warn("Gagal hapus gambar lama:", url, err);
               else console.log("Gambar lama sudah tidak ada di storage:", url);
           }
         });
         await Promise.all(deletePromises);
       } else {
         console.log("Tidak ada gambar lama yang perlu dihapus dari Storage.");
       }

      // 6. Simpan array URL final ke Firestore
      console.log("Menyimpan ke Firestore...");
      await setDoc(galleryDocRef, {
        imageUrls: finalImageUrls,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      console.log("Berhasil menyimpan ke Firestore.");

      // 7. Update state lokal setelah simpan berhasil
      setCurrentImageUrls(finalImageUrls); // Update data asli
      setNewImageData([]); // Kosongkan file baru
      setImagePreviews(finalImageUrls); // Preview sekarang HANYA berisi URL tersimpan

      setToast({ msg: "Galeri berhasil disimpan!", type: "success" });

    } catch (error: any) {
      console.error("GAGAL TOTAL menyimpan galeri:", error);
      // Tampilkan pesan error spesifik jika dari upload
      const uploadFailed = error.message.startsWith("Gagal upload");
      setToast({
          msg: uploadFailed ? error.message : "Gagal menyimpan galeri. Cek console.",
          type: "error"
      });
    } finally {
      setIsSaving(false);
      console.log("handleSaveGallery Selesai.");
    }
  };

  // --- Render Halaman (Sama) ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat galeri..." />}
      {isSaving && <Loader text="Menyimpan galeri..." />}

      {/* Header Halaman (Sama) */}
      <div className="flex items-center justify-between mb-6">
         {/* ... (kode header sama) ... */}
         <div className="flex items-center gap-4">
          <Link href="/dashboard/cms">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali ke Hpanel
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Edit Galeri Foto</h2>
        </div>
        {/* Tombol Simpan di Header */}
        <button
          onClick={handleSaveGallery}
          disabled={isSaving || isLoading}
          className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
          Simpan Galeri
        </button>
      </div>

      {/* Konten Utama (Sama) */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
         {/* ... (kode konten sama) ... */}
         <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
          <i className="fas fa-images mr-2 text-pink-500"></i> Kelola Foto Galeri (Maks 100)
        </h3>

        {/* Grid Preview Foto */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          {imagePreviews.map((previewUrl, index) => (
            <div key={`${previewUrl}-${index}`} className="relative group aspect-square"> {/* Tambah index ke key untuk kasus URL sama */}
              <img
                src={previewUrl}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-gray-200"
              />
              {/* Tombol Hapus Preview */}
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 shadow"
                aria-label="Hapus gambar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ))}

          {/* Tombol Placeholder Tambah Foto */}
          {imagePreviews.length < 100 && (
            <label htmlFor="galleryImages" className="cursor-pointer aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors">
               <i className="fas fa-plus fa-2x mb-1"></i>
               <span className="text-xs font-medium">Tambah Foto</span>
             </label>
           )}
        </div>

        {/* Input File Tersembunyi */}
        <input
          id="galleryImages"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImageChange}
          disabled={imagePreviews.length >= 100 || isSaving}
          className="hidden" // Sembunyikan input asli
        />
        {imagePreviews.length >= 100 && (
          <p className="text-sm text-center text-red-600 mb-4">Batas maksimal 100 foto tercapai.</p>
        )}
      </div>
    </>
  );
}

