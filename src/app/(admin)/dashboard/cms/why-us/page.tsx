// Ini adalah file BARU: app/admin/dashboard/cms/why-us/page.tsx
// Halaman untuk mengelola poin keunggulan "Kenapa Pilih Kami"
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config"; // <-- Path ke config (5x ../)
// Tidak perlu storage di sini
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp, // Import Timestamp
  orderBy,
  serverTimestamp
} from "firebase/firestore";
// Tidak perlu import storage

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

// --- Tipe Data untuk Poin "Why Us" ---
interface WhyUsPoint {
  id: string;
  icon: string; // Misal: 'star', 'check', 'award', dll. (Nama ikon tanpa fa-)
  title: string;
  description: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// === Daftar Ikon Pilihan (Diperbarui & Diperbanyak) ===
const availableIcons = [
  // Umum & Kualitas
  { value: 'star', label: 'Bintang (star)' },
  { value: 'check-circle', label: 'Ceklis Lingkaran (check-circle)' },
  { value: 'thumbs-up', label: 'Jempol (thumbs-up)' },
  { value: 'award', label: 'Penghargaan (award)' },
  { value: 'heart', label: 'Hati (heart)' },
  { value: 'shield-alt', label: 'Perisai/Keamanan (shield-alt)' }, // FA5
  { value: 'gem', label: 'Permata/Kualitas (gem)' },
  { value: 'medal', label: 'Medali (medal)' },
  { value: 'certificate', label: 'Sertifikat (certificate)' },

  // Travel & Transportasi
  { value: 'map-marker-alt', label: 'Penanda Peta (map-marker-alt)' }, // FA5
  { value: 'car', label: 'Mobil (car)' },
  { value: 'bus', label: 'Bus (bus)' },
  { value: 'route', label: 'Rute/Perjalanan (route)' },
  { value: 'suitcase-rolling', label: 'Koper (suitcase-rolling)' },
  { value: 'mountain', label: 'Gunung (mountain)' },
  { value: 'tree', label: 'Pohon/Alam (tree)' },
  { value: 'umbrella-beach', label: 'Payung Pantai (umbrella-beach)' },
  { value: 'camera-retro', label: 'Kamera Retro (camera-retro)' },

  // Layanan & Dukungan
  { value: 'users', label: 'Tim/Grup (users)' },
  { value: 'headset', label: 'Dukungan/CS (headset)' },
  { value: 'comments', label: 'Testimoni/Chat (comments)' },
  { value: 'calendar-check', label: 'Jadwal/Booking (calendar-check)' },
  { value: 'handshake', label: 'Kerjasama/Partner (handshake)' },
  { value: 'concierge-bell', label: 'Layanan/Hotel (concierge-bell)' },

  // Keuangan
  { value: 'dollar-sign', label: 'Harga/Dollar (dollar-sign)' },
  { value: 'wallet', label: 'Dompet/Pembayaran (wallet)' },
  { value: 'tags', label: 'Diskon/Tag (tags)' },

  // Lainnya
  { value: 'clock', label: 'Waktu/Durasi (clock)' },
  { value: 'wifi', label: 'Wifi (wifi)' },
  { value: 'utensils', label: 'Makan/Restoran (utensils)' },
];


// === Halaman Edit "Why Us" ===
export default function EditWhyUsPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading data awal
  const [isSaving, setIsSaving] = useState(false); // Loading saat simpan/hapus
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk Data Poin ===
  const [whyUsPoints, setWhyUsPoints] = useState<WhyUsPoint[]>([]);

  // === State untuk Modal Form ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [pointIcon, setPointIcon] = useState("star"); // Default icon value (tanpa fa-)
  const [pointTitle, setPointTitle] = useState("");
  const [pointDescription, setPointDescription] = useState("");

  // Referensi ke koleksi Firestore
  const whyUsCollectionRef = collection(db, "whyUsPoints");

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
      if (whyUsPoints.length === 0 && !isModalOpen) { // Jangan set loading jika modal terbuka
          setIsLoading(true);
      }
      // Urutkan berdasarkan createdAt (jika ada)
      const q = query(whyUsCollectionRef, orderBy("createdAt", "asc"));
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const pointsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhyUsPoint));
        setWhyUsPoints(pointsData);
        setIsLoading(false); // Stop loading setelah data diterima
      }, (error) => {
        console.error("Gagal mengambil data Why Us:", error);
        setToast({ msg: "Gagal memuat data.", type: "error" });
        setIsLoading(false);
      });
    } else {
        setIsLoading(false); // Berhenti loading jika belum login
    }

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot(); // Hentikan listener saat komponen unmount
    };
  }, [router, userUID, isModalOpen]); // Tambahkan isModalOpen agar tidak loading saat modal


  // --- Fungsi Buka/Tutup Modal ---
  const resetForm = () => {
    setCurrentEditingId(null);
    setPointIcon("star"); // Kembalikan ke default value
    setPointTitle("");
    setPointDescription("");
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (point: WhyUsPoint) => {
    resetForm();
    setCurrentEditingId(point.id);
    setPointIcon(point.icon || "star"); // Ambil value icon
    setPointTitle(point.title);
    setPointDescription(point.description);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    resetForm();
    setIsModalOpen(false);
  };


  // --- Fungsi Simpan (Create/Update) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID || !pointTitle) {
       setToast({ msg: "Judul poin wajib diisi.", type: "error" });
       return;
    }
     if (!pointIcon) {
       setToast({ msg: "Ikon wajib dipilih.", type: "error" });
       return;
    }
    setIsSaving(true);
    setToast(null);

    try {
      // Siapkan Data
      const dataToSave = {
        icon: pointIcon, // Simpan value ikon
        title: pointTitle,
        description: pointDescription,
        updatedAt: serverTimestamp(),
      };

      // Update atau Create
      if (currentEditingId) {
        // Update
        const docRef = doc(db, "whyUsPoints", currentEditingId);
        await updateDoc(docRef, dataToSave);
        console.log("Poin Why Us diupdate:", currentEditingId);
      } else {
        // Create
        const docRef = await addDoc(whyUsCollectionRef, {
          ...dataToSave,
          createdAt: serverTimestamp(), // Tambahkan createdAt saat baru
        });
        console.log("Poin Why Us baru ditambahkan:", docRef.id);
      }

      setToast({ msg: "Poin 'Kenapa Asoka?' berhasil disimpan!", type: "success" });
      closeModal();

    } catch (error: any) {
      console.error("Gagal menyimpan poin:", error);
      setToast({ msg: `Gagal menyimpan: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Fungsi Hapus ---
  const handleDelete = async (point: WhyUsPoint) => {
    if (!confirm(`Yakin ingin menghapus poin "${point.title}"?`)) return;
    setIsSaving(true);
    setToast(null);
    try {
      // Hapus dokumen Firestore
      await deleteDoc(doc(db, "whyUsPoints", point.id));
      console.log("Dokumen Why Us dihapus:", point.id);
      setToast({ msg: "Poin berhasil dihapus.", type: "success" });
    } catch (error: any) {
      console.error("Gagal menghapus poin:", error);
      setToast({ msg: `Gagal menghapus: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat data..." />}
      {isSaving && <Loader text="Menyimpan/Menghapus..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cms">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali ke Hpanel
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Edit 'Kenapa Asoka?'</h2>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Tambah Poin
        </button>
      </div>

      {/* Konten Utama: Daftar Poin */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
          <i className="fas fa-heart mr-2 text-yellow-500"></i> Poin Keunggulan
        </h3>
        {/* Tampilkan daftar atau pesan kosong */}
        {isLoading ? (
            <p className="text-center py-6 text-gray-500">Memuat...</p>
        ) : whyUsPoints.length > 0 ? (
          <ul className="space-y-4">
            {whyUsPoints.map(point => (
              <li key={point.id} className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg bg-gray-50 group hover:bg-white hover:shadow-md transition-all">
                {/* Ikon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mt-1">
                  {/* Tambahkan prefix 'fa-' saat menampilkan */}
                  <i className={`fas fa-${point.icon || 'star'}`}></i>
                </div>
                {/* Teks */}
                <div className="flex-grow">
                  <h4 className="font-bold text-gray-800">{point.title}</h4>
                  <p className="text-sm text-gray-600 mt-0.5">{point.description}</p>
                </div>
                {/* Tombol Aksi */}
                <div className="flex-shrink-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                   <button
                    onClick={() => handleEdit(point)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Edit"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(point)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    title="Hapus"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500 py-10">
            Belum ada poin keunggulan. Klik "Tambah Poin" untuk memulai.
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
                {currentEditingId ? "Edit Poin Keunggulan" : "Tambah Poin Baru"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times fa-lg"></i>
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <form id="whyUsForm" onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-5">
              {/* --- Input Ikon (Dropdown) --- */}
              <div>
                <label htmlFor="pointIconSelect" className="block text-sm font-medium text-gray-700 mb-1">
                    Pilih Ikon
                </label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-gray-100 border border-gray-300">
                      {/* Tambahkan prefix 'fa-' saat menampilkan preview */}
                      <i className={`fas fa-${pointIcon || 'star'} text-gray-600`}></i>
                  </span>
                  <select
                    id="pointIconSelect"
                    value={pointIcon}
                    onChange={(e) => setPointIcon(e.target.value)}
                    required // Jadikan wajib dipilih
                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                  >
                    {/* Hapus opsi disabled agar user harus memilih */}
                    {/* <option value="" disabled>-- Pilih Ikon --</option> */}
                    {availableIcons.map(icon => (
                       <option key={icon.value} value={icon.value}>
                         {icon.label}
                       </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Judul Poin */}
              <div>
                <label htmlFor="pointTitle" className="block text-sm font-medium text-gray-700 mb-1">Judul Poin</label>
                <input id="pointTitle" type="text" value={pointTitle} onChange={(e) => setPointTitle(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
              </div>

              {/* Deskripsi Singkat */}
              <div>
                <label htmlFor="pointDescription" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat</label>
                <textarea id="pointDescription" value={pointDescription} onChange={(e) => setPointDescription(e.target.value)} rows={4} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Jelaskan keunggulan ini secara singkat..."></textarea>
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
                form="whyUsForm" // Hubungkan ke ID form
                disabled={isSaving}
                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {currentEditingId ? "Update Poin" : "Simpan Poin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

