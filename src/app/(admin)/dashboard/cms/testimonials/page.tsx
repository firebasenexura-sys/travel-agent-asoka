// Ini adalah file BARU: app/admin/dashboard/cms/testimonials/page.tsx
// Halaman untuk mengelola testimoni pelanggan
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
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

// --- Tipe Data untuk Testimoni ---
interface Testimonial {
  id: string;
  customerName: string; // Nama pelanggan
  quote: string;        // Isi testimoni/kutipan
  // Tambahkan field lain jika perlu, misal: rating (number), date (Timestamp), etc.
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}


// === Halaman Kelola Testimoni ===
export default function ManageTestimonialsPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading data awal
  const [isSaving, setIsSaving] = useState(false); // Loading saat simpan/hapus
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk Data Testimoni ===
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // === State untuk Modal Form ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [quote, setQuote] = useState("");

  // Referensi ke koleksi Firestore
  const testimonialsCollectionRef = collection(db, "testimonials");

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
      if (testimonials.length === 0 && !isModalOpen) {
          setIsLoading(true);
      }
      // Urutkan berdasarkan createdAt descending (terbaru dulu)
      const q = query(testimonialsCollectionRef, orderBy("createdAt", "desc"));
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const testimonialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Testimonial));
        setTestimonials(testimonialsData);
        setIsLoading(false); // Stop loading setelah data diterima
      }, (error) => {
        console.error("Gagal mengambil data testimoni:", error);
        setToast({ msg: "Gagal memuat data testimoni.", type: "error" });
        setIsLoading(false);
      });
    } else {
        setIsLoading(false); // Berhenti loading jika belum login
    }

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot(); // Hentikan listener saat komponen unmount
    };
  }, [router, userUID, isModalOpen]);


  // --- Fungsi Buka/Tutup Modal ---
  const resetForm = () => {
    setCurrentEditingId(null);
    setCustomerName("");
    setQuote("");
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (testimonial: Testimonial) => {
    resetForm();
    setCurrentEditingId(testimonial.id);
    setCustomerName(testimonial.customerName);
    setQuote(testimonial.quote);
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
    if (!userUID || !customerName || !quote) {
       setToast({ msg: "Nama pelanggan dan isi testimoni wajib diisi.", type: "error" });
       return;
    }
    setIsSaving(true);
    setToast(null);

    try {
      // Siapkan Data
      const dataToSave = {
        customerName: customerName,
        quote: quote,
        updatedAt: serverTimestamp(),
      };

      // Update atau Create
      if (currentEditingId) {
        // Update
        const docRef = doc(db, "testimonials", currentEditingId);
        await updateDoc(docRef, dataToSave);
        console.log("Testimoni diupdate:", currentEditingId);
      } else {
        // Create
        const docRef = await addDoc(testimonialsCollectionRef, {
          ...dataToSave,
          createdAt: serverTimestamp(), // Tambahkan createdAt saat baru
        });
        console.log("Testimoni baru ditambahkan:", docRef.id);
      }

      setToast({ msg: "Testimoni berhasil disimpan!", type: "success" });
      closeModal();

    } catch (error: any) {
      console.error("Gagal menyimpan testimoni:", error);
      setToast({ msg: `Gagal menyimpan: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Fungsi Hapus ---
  const handleDelete = async (testimonial: Testimonial) => {
    if (!confirm(`Yakin ingin menghapus testimoni dari "${testimonial.customerName}"?`)) return;
    setIsSaving(true);
    setToast(null);
    try {
      // Hapus dokumen Firestore
      await deleteDoc(doc(db, "testimonials", testimonial.id));
      console.log("Dokumen testimoni dihapus:", testimonial.id);
      setToast({ msg: "Testimoni berhasil dihapus.", type: "success" });
    } catch (error: any) {
      console.error("Gagal menghapus testimoni:", error);
      setToast({ msg: `Gagal menghapus: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat testimoni..." />}
      {isSaving && <Loader text="Menyimpan/Menghapus..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cms">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali ke Hpanel
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Kelola Testimoni</h2>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Tambah Testimoni
        </button>
      </div>

      {/* Konten Utama: Daftar Testimoni */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
          <i className="fas fa-comments mr-2 text-teal-500"></i> Daftar Testimoni
        </h3>
        {/* Tampilkan daftar atau pesan kosong */}
        {isLoading ? (
            <p className="text-center py-6 text-gray-500">Memuat...</p>
        ) : testimonials.length > 0 ? (
          <ul className="space-y-4">
            {testimonials.map(testimonial => (
              <li key={testimonial.id} className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg bg-gray-50 group hover:bg-white hover:shadow-md transition-all">
                {/* Ikon Kutipan */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mt-1">
                  <i className="fas fa-quote-left"></i>
                </div>
                {/* Teks */}
                <div className="flex-grow">
                  <blockquote className="text-gray-700 italic">"{testimonial.quote}"</blockquote>
                  <p className="text-sm font-semibold text-gray-900 mt-2">- {testimonial.customerName}</p>
                </div>
                {/* Tombol Aksi */}
                <div className="flex-shrink-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                   <button
                    onClick={() => handleEdit(testimonial)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Edit"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(testimonial)}
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
            Belum ada testimoni. Klik "Tambah Testimoni" untuk memulai.
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
                {currentEditingId ? "Edit Testimoni" : "Tambah Testimoni Baru"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times fa-lg"></i>
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <form id="testimonialForm" onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-5">

              {/* Nama Pelanggan */}
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Nama Pelanggan</label>
                <input id="customerName" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
              </div>

              {/* Isi Testimoni */}
              <div>
                <label htmlFor="quote" className="block text-sm font-medium text-gray-700 mb-1">Isi Testimoni / Kutipan</label>
                <textarea id="quote" value={quote} onChange={(e) => setQuote(e.target.value)} rows={6} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Tuliskan testimoni pelanggan di sini..."></textarea>
              </div>

              {/* Tambahkan input lain jika perlu, misal Rating Bintang */}

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
                form="testimonialForm" // Hubungkan ke ID form
                disabled={isSaving}
                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {currentEditingId ? "Update Testimoni" : "Simpan Testimoni"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
