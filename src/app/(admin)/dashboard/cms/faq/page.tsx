// Ini adalah file BARU: app/admin/dashboard/cms/faq/page.tsx
// Halaman untuk mengelola Frequently Asked Questions (FAQ)
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

// --- Tipe Data untuk FAQ (Ditambah Icon) ---
interface FaqItem {
  id: string;
  icon?: string; // Nama ikon Font Awesome (tanpa fa-), opsional
  question: string;
  answer: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// === Daftar Ikon Pilihan untuk FAQ ===
const availableFaqIcons = [
  { value: 'question-circle', label: 'Tanda Tanya Lingkaran (question-circle)' },
  { value: 'info-circle', label: 'Info Lingkaran (info-circle)' },
  { value: 'comment-dots', label: 'Balon Chat Titik (comment-dots)' },
  { value: 'comments', label: 'Balon Chat Banyak (comments)' },
  { value: 'book-open', label: 'Buku Terbuka (book-open)' },
  { value: 'lightbulb', label: 'Lampu Bohlam (lightbulb)' },
  { value: 'headset', label: 'Headset/Support (headset)' },
  { value: 'check', label: 'Ceklis (check)' },
  { value: 'star', label: 'Bintang (star)' }, // Default
];


// === Halaman Kelola FAQ ===
export default function ManageFaqPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading data awal
  const [isSaving, setIsSaving] = useState(false); // Loading saat simpan/hapus
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk Data FAQ ===
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);


  // === State untuk Modal Form (Ditambah Icon) ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [faqIcon, setFaqIcon] = useState("question-circle"); // Default ikon FAQ
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  // Referensi ke koleksi Firestore
  const faqsCollectionRef = collection(db, "faqs"); // Nama koleksi: faqs

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
      if (faqs.length === 0 && !isModalOpen) {
          setIsLoading(true);
      }
      // Urutkan berdasarkan createdAt ascending (paling lama dulu)
      const q = query(faqsCollectionRef, orderBy("createdAt", "asc"));
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const faqsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FaqItem));
        setFaqs(faqsData);
        setIsLoading(false); // Stop loading setelah data diterima
      }, (error) => {
        console.error("Gagal mengambil data FAQ:", error);
        setToast({ msg: "Gagal memuat data FAQ.", type: "error" });
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
    setFaqIcon("question-circle"); // Reset ke default FAQ
    setFaqQuestion("");
    setFaqAnswer("");
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (faq: FaqItem) => {
    resetForm();
    setCurrentEditingId(faq.id);
    setFaqIcon(faq.icon || "question-circle"); // Ambil ikon, fallback ke default
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    resetForm();
    setIsModalOpen(false);
  };


  // --- Fungsi Simpan (Create/Update - Ditambah Icon) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID || !faqQuestion || !faqAnswer || !faqIcon) { // Tambah cek ikon
       setToast({ msg: "Ikon, Pertanyaan, dan Jawaban wajib diisi.", type: "error" });
       return;
    }
    setIsSaving(true);
    setToast(null);

    try {
      // Siapkan Data (dengan ikon)
      const dataToSave = {
        icon: faqIcon,
        question: faqQuestion,
        answer: faqAnswer,
        updatedAt: serverTimestamp(),
      };

      // Update atau Create
      if (currentEditingId) {
        // Update
        const docRef = doc(db, "faqs", currentEditingId);
        await updateDoc(docRef, dataToSave);
        console.log("FAQ diupdate:", currentEditingId);
      } else {
        // Create
        const docRef = await addDoc(faqsCollectionRef, {
          ...dataToSave,
          createdAt: serverTimestamp(), // Tambahkan createdAt saat baru
        });
        console.log("FAQ baru ditambahkan:", docRef.id);
      }

      setToast({ msg: "FAQ berhasil disimpan!", type: "success" });
      closeModal();

    } catch (error: any) {
      console.error("Gagal menyimpan FAQ:", error);
      setToast({ msg: `Gagal menyimpan: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Fungsi Hapus ---
  const handleDelete = async (faq: FaqItem) => {
    if (!confirm(`Yakin ingin menghapus FAQ "${faq.question}"?`)) return;
    setIsSaving(true);
    setToast(null);
    try {
      // Hapus dokumen Firestore
      await deleteDoc(doc(db, "faqs", faq.id));
      console.log("Dokumen FAQ dihapus:", faq.id);
      setToast({ msg: "FAQ berhasil dihapus.", type: "success" });
    } catch (error: any) {
      console.error("Gagal menghapus FAQ:", error);
      setToast({ msg: `Gagal menghapus: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Fungsi Toggle Accordion ---
  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat FAQ..." />}
      {isSaving && <Loader text="Menyimpan/Menghapus..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cms">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali ke Hpanel
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Kelola FAQ</h2>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Tambah FAQ
        </button>
      </div>

      {/* Konten Utama: Daftar FAQ (Accordion dengan Ikon) */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
          <i className="fas fa-question-circle mr-2 text-blue-500"></i> Daftar Pertanyaan Umum
        </h3>
        {isLoading ? (
            <p className="text-center py-6 text-gray-500">Memuat...</p>
        ) : faqs.length > 0 ? (
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={faq.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Tombol Accordion (dengan Ikon) */}
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                >
                  {/* Ikon dan Pertanyaan */}
                  <div className="flex items-center gap-3">
                     <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex-shrink-0">
                         <i className={`fas fa-${faq.icon || 'question-circle'}`}></i>
                     </span>
                     <span className="font-medium text-left text-gray-800">{faq.question}</span>
                  </div>
                  {/* Panah Chevron */}
                  <i className={`fas fa-chevron-down transition-transform duration-200 text-gray-500 ${openIndex === index ? 'rotate-180' : ''}`}></i>
                </button>
                {/* Konten Accordion */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-96' : 'max-h-0'}`}>
                   <div className="p-4 border-t border-gray-200 bg-white space-y-3">
                     <p className="text-sm text-gray-700 whitespace-pre-line">{faq.answer}</p>
                     {/* Tombol Edit & Hapus di dalam */}
                     <div className="flex justify-end gap-3 pt-2">
                        <button
                          onClick={() => handleEdit(faq)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(faq)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                          title="Hapus"
                        >
                          <i className="fas fa-trash"></i> Hapus
                        </button>
                     </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-10">
            Belum ada FAQ. Klik "Tambah FAQ" untuk memulai.
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
                {currentEditingId ? "Edit FAQ" : "Tambah FAQ Baru"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times fa-lg"></i>
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <form id="faqForm" onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-5">

               {/* --- Input Ikon (Dropdown) --- */}
              <div>
                <label htmlFor="faqIconSelect" className="block text-sm font-medium text-gray-700 mb-1">
                    Pilih Ikon
                </label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-gray-100 border border-gray-300">
                      <i className={`fas fa-${faqIcon || 'question-circle'} text-gray-600`}></i>
                  </span>
                  <select
                    id="faqIconSelect"
                    value={faqIcon}
                    onChange={(e) => setFaqIcon(e.target.value)}
                    required // Jadikan wajib dipilih
                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                  >
                    {/* Hapus opsi disabled */}
                    {availableFaqIcons.map(icon => (
                       <option key={icon.value} value={icon.value}>
                         {icon.label}
                       </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pertanyaan */}
              <div>
                <label htmlFor="faqQuestion" className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
                <input id="faqQuestion" type="text" value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
              </div>

              {/* Jawaban */}
              <div>
                <label htmlFor="faqAnswer" className="block text-sm font-medium text-gray-700 mb-1">Jawaban</label>
                <textarea id="faqAnswer" value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} rows={8} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Tuliskan jawaban di sini..."></textarea>
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
                form="faqForm" // Hubungkan ke ID form
                disabled={isSaving}
                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {currentEditingId ? "Update FAQ" : "Simpan FAQ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

