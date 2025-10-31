// Ini adalah file BARU: app/admin/dashboard/cms/destinations/page.tsx
// Halaman untuk mengelola destinasi unggulan
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config"; // <-- Path ke config (5x ../)
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp, // Import Timestamp jika belum ada
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";

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

// --- Tipe Data untuk Destinasi ---
interface Destination {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt?: Timestamp; // Opsional, tergantung apakah Anda simpan
  updatedAt?: Timestamp; // Opsional
}


// === Halaman Edit Destinasi ===
export default function EditDestinationsPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading data awal
  const [isSaving, setIsSaving] = useState(false); // Loading saat simpan/hapus
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk Data Destinasi ===
  const [destinations, setDestinations] = useState<Destination[]>([]);

  // === State untuk Modal Form ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [destName, setDestName] = useState("");
  const [destDescription, setDestDescription] = useState("");
  const [destImageFile, setDestImageFile] = useState<File | null>(null);
  const [destImagePreview, setDestImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null); // URL lama saat edit

  // Referensi ke koleksi Firestore
  const destinationsCollectionRef = collection(db, "destinations");

  // --- Cek Auth & Ambil Data Awal ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUID(user.uid);
      } else {
        router.push("/admin"); // Tendang jika tidak login
      }
    });

    // Listener Firestore (hanya aktif jika user login)
    let unsubscribeSnapshot = () => {};
    if (userUID) {
      // Hanya loading jika data belum ada
      if (destinations.length === 0) {
          setIsLoading(true);
      }
      const q = query(destinationsCollectionRef, orderBy("name", "asc")); // Urutkan berdasarkan nama
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const destData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Destination));
        setDestinations(destData);
        setIsLoading(false); // Stop loading setelah data diterima
      }, (error) => {
        console.error("Gagal mengambil data destinasi:", error);
        setToast({ msg: "Gagal memuat data destinasi.", type: "error" });
        setIsLoading(false);
      });
    } else {
        setIsLoading(false); // Berhenti loading jika belum login
    }

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot(); // Hentikan listener saat komponen unmount
    };
  }, [router, userUID]); // Depend on userUID


  // --- Fungsi Buka/Tutup Modal ---
  const resetForm = () => {
    setCurrentEditingId(null);
    setDestName("");
    setDestDescription("");
    setDestImageFile(null);
    setDestImagePreview(null);
    setCurrentImageUrl(null);
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (dest: Destination) => {
    resetForm();
    setCurrentEditingId(dest.id);
    setDestName(dest.name);
    setDestDescription(dest.description);
    setDestImagePreview(dest.imageUrl); // Tampilkan gambar lama
    setCurrentImageUrl(dest.imageUrl);   // Simpan URL lama
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    resetForm();
    setIsModalOpen(false);
  };

  // --- Fungsi Handle Upload Gambar ---
   const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Limit 2MB
        setToast({ msg: "Ukuran foto maksimal 2 MB.", type: "error" });
        return;
      }
      setDestImageFile(file); // Simpan File object
      setDestImagePreview(URL.createObjectURL(file)); // Buat & simpan Object URL preview
    }
  };


  // --- Fungsi Simpan (Create/Update) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID || !destName) {
       setToast({ msg: "Nama destinasi wajib diisi.", type: "error" });
       return;
    }
    // Wajibkan gambar saat tambah baru
    if (!currentEditingId && !destImageFile) {
        setToast({ msg: "Foto destinasi wajib diupload.", type: "error" });
        return;
    }

    setIsSaving(true);
    setToast(null);

    try {
      let finalImageUrl = currentImageUrl || ""; // Default pakai URL lama

      // 1. Upload Gambar Baru (jika ada file dipilih)
      if (destImageFile) {
        // Hapus gambar lama di storage JIKA ada gambar lama DAN ada file baru
        if (currentImageUrl) {
           try {
             // Dapatkan referensi dari URL https
             const oldImageRef = ref(storage, currentImageUrl);
             await deleteObject(oldImageRef);
             console.log("Gambar lama destinasi dihapus");
           } catch (deleteError: any) {
             if (deleteError.code !== 'storage/object-not-found') {
               console.warn("Gagal hapus gambar lama, tapi lanjut:", deleteError);
             }
           }
        }
        // Upload gambar baru
        const fileName = `${userUID}_dest_${Date.now()}_${destImageFile.name}`;
        const storageRef = ref(storage, `destinations/${fileName}`); // Simpan di folder 'destinations'
        console.log(`Uploading ke: destinations/${fileName}`);
        const uploadTask = await uploadBytes(storageRef, destImageFile);
        finalImageUrl = await getDownloadURL(uploadTask.ref); // Dapatkan URL baru
        console.log("Upload gambar destinasi berhasil:", finalImageUrl);
      } else if (!currentEditingId && !finalImageUrl) {
        // Kasus ini seharusnya sudah dicegah di awal, tapi sebagai fallback
         throw new Error("Gambar destinasi wajib ada untuk item baru.");
      }


      // 2. Siapkan Data
      const dataToSave = {
        name: destName,
        description: destDescription,
        imageUrl: finalImageUrl, // Simpan URL (baru atau lama)
        updatedAt: serverTimestamp(),
      };

      // 3. Update atau Create
      if (currentEditingId) {
        // Update
        const docRef = doc(db, "destinations", currentEditingId);
        await updateDoc(docRef, dataToSave);
        console.log("Destinasi diupdate:", currentEditingId);
      } else {
        // Create
        const docRef = await addDoc(destinationsCollectionRef, {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        console.log("Destinasi baru ditambahkan:", docRef.id);
      }

      setToast({ msg: "Destinasi berhasil disimpan!", type: "success" });
      closeModal();

    } catch (error: any) {
      console.error("Gagal menyimpan destinasi:", error);
      setToast({ msg: `Gagal menyimpan: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Fungsi Hapus ---
  const handleDelete = async (dest: Destination) => {
    if (!confirm(`Yakin ingin menghapus destinasi "${dest.name}"?`)) return;
    setIsSaving(true); // Gunakan state saving untuk loader
    setToast(null);
    try {
      // 1. Hapus dokumen Firestore
      await deleteDoc(doc(db, "destinations", dest.id));
      console.log("Dokumen Firestore dihapus:", dest.id);

      // 2. Hapus gambar di Storage (jika ada URL)
      if (dest.imageUrl) {
        try {
          // Dapatkan referensi dari URL https
          const imageRef = ref(storage, dest.imageUrl);
          await deleteObject(imageRef);
          console.log("Gambar Storage dihapus:", dest.imageUrl);
        } catch (deleteError: any) {
          // Abaikan error jika file tidak ditemukan
          if (deleteError.code !== 'storage/object-not-found') {
            console.warn("Gagal hapus gambar, tapi dokumen terhapus:", deleteError);
          } else {
              console.log("Gambar sudah tidak ada di storage:", dest.imageUrl);
          }
        }
      }
      setToast({ msg: "Destinasi berhasil dihapus.", type: "success" });
    } catch (error: any) {
      console.error("Gagal menghapus destinasi:", error);
      setToast({ msg: `Gagal menghapus: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat destinasi..." />}
      {isSaving && <Loader text="Menyimpan/Menghapus..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cms">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali ke Hpanel
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Destinasi Unggulan</h2>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Tambah Destinasi
        </button>
      </div>

      {/* Konten Utama: Grid Kartu Destinasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {destinations.map(dest => (
          <div key={dest.id} className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden transition-all hover:shadow-xl relative group">
            {/* Gambar */}
            <div className="aspect-video bg-gray-200"> {/* Rasio 16:9 */}
              <img
                src={dest.imageUrl || "https://placehold.co/400x225/e2e8f0/94a3b8?text=No+Image"}
                alt={dest.name}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Konten Kartu */}
            <div className="p-4 flex flex-col flex-grow">
              <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{dest.name}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 flex-grow">{dest.description || "Tidak ada deskripsi."}</p>
              {/* Tombol Aksi (Muncul saat hover) */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
                <button
                  onClick={() => handleEdit(dest)}
                  className="w-full bg-blue-100 text-blue-700 font-semibold py-2 px-3 rounded-lg hover:bg-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <i className="fas fa-edit mr-1"></i> Edit
                </button>
                <button
                  onClick={() => handleDelete(dest)}
                  className="w-full bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-lg hover:bg-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                >
                  <i className="fas fa-trash mr-1"></i> Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
        {/* Pesan jika kosong */}
        {!isLoading && destinations.length === 0 && (
          <p className="text-center text-gray-500 py-10 col-span-full">
            Belum ada destinasi unggulan. Klik "Tambah Destinasi" untuk memulai.
          </p>
        )}
      </div>

      {/* === MODAL FORM TAMBAH/EDIT === */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div onClick={closeModal} className="absolute inset-0"></div>
          {/* Modal Card */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {currentEditingId ? "Edit Destinasi" : "Tambah Destinasi Baru"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times fa-lg"></i>
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            {/* Hubungkan form ke handleSave */}
            <form id="destinationForm" onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-5">
              {/* Nama Destinasi */}
              <div>
                <label htmlFor="destName" className="block text-sm font-medium text-gray-700 mb-1">Nama Destinasi</label>
                <input id="destName" type="text" value={destName} onChange={(e) => setDestName(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
              </div>

              {/* Deskripsi Singkat */}
              <div>
                <label htmlFor="destDescription" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat</label>
                <textarea id="destDescription" value={destDescription} onChange={(e) => setDestDescription(e.target.value)} rows={4} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Jelaskan daya tarik utama destinasi ini..."></textarea>
              </div>

              {/* Upload Gambar */}
              <div className="space-y-2">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Foto Utama (Maks 2MB)</label>
                 {/* Preview */}
                 {destImagePreview ? (
                   <img
                     src={destImagePreview}
                     alt="Preview"
                     className="w-full aspect-video object-cover border border-gray-200 rounded-lg bg-gray-50 mb-2" // aspect-video
                   />
                 ) : (
                   <div className="w-full aspect-video flex items-center justify-center border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 mb-2">
                     Image Preview
                   </div>
                 )}
                 <input
                   id="destImageFile"
                   type="file"
                   accept="image/png, image/jpeg, image/webp"
                   onChange={handleImageChange}
                   className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                 />
              </div>

            </form>

            {/* Footer Modal */}
            <div className="flex items-center justify-end p-5 border-t border-gray-200 sticky bottom-0 bg-gray-50 rounded-b-2xl z-10">
              <button
                onClick={closeModal}
                type="button"
                className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-lg border border-gray-300 mr-3 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="destinationForm" // Hubungkan ke ID form
                disabled={isSaving}
                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {currentEditingId ? "Update Destinasi" : "Simpan Destinasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

