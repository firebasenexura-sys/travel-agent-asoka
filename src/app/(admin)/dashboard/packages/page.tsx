// Ini adalah file: app/admin/dashboard/packages/page.tsx
// VERSI 3: Perbaikan import path + Multi-Foto + YouTube
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// --- PATH IMPORT SUDAH DIPERBAIKI ---
import { auth, db, storage } from "@lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";

// --- Tipe Data (Diperbarui) ---
interface Package {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: 'active' | 'draft';
  price: number;
  unit: string;
  buttonText: string;
  minPax: number;
  maxPax: number;
  duration: string;
  location: string;
  description: string;
  features: string[];
  exclusions: string;
  itinerary: string;
  terms: string;
  imageUrls: string[]; // <-- Diubah menjadi array
  youtubeUrl?: string; // <-- Field BARU (opsional)
  vendorId: string;
  createdAt: Timestamp;
}

// --- Komponen Toast/Notifikasi ---
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void; }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-lg text-white ${bgColor}`}>
      {message}
    </div>
  );
}

// --- Komponen Loader ---
function Loader({ text = "Memuat..." }: { text?: string; }) {
  return (
    <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-700 font-semibold">{text}</p>
      </div>
    </div>
  );
}

// === Halaman Utama ===
export default function ManagePackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [userUID, setUserUID] = useState<string | null>(null);

  // === State untuk Form ===
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("private-wisata-alam");
  const [status, setStatus] = useState<'active' | 'draft'>("draft");
  const [price, setPrice] = useState(0);
  const [unit, setUnit] = useState("/pax");
  const [buttonText, setButtonText] = useState("Chat via WA");
  const [minPax, setMinPax] = useState(1);
  const [maxPax, setMaxPax] = useState(6);
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [itinerary, setItinerary] = useState("");
  const [terms, setTerms] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // --- Cek Auth & Ambil Data ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUID(user.uid);
      } else {
        router.push("/admin");
      }
    });

    // Hanya jalankan query jika userUID sudah ada
    let unsubscribeSnapshot = () => {};
    if (userUID) {
      const q = query(
        collection(db, "packages"),
        // where("vendorId", "==", userUID), // <-- Nanti aktifkan jika perlu vendor-specific
        orderBy("createdAt", "desc")
      );
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const packagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
        setPackages(packagesData);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching packages: ", error);
        setToast({ msg: "Gagal memuat data paket.", type: "error" });
        setIsLoading(false);
      });
    } else {
      setIsLoading(false); // Berhenti loading jika belum login
    }

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, [router, userUID]); // <-- userUID ditambahkan sebagai dependency

  // --- Fungsi Slug ---
  const createSlug = (text: string) => {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  // --- Fungsi Buka/Tutup Modal ---
  const resetForm = () => {
    setName(""); setSlug(""); setCategory("private-wisata-alam");
    setStatus("draft"); setPrice(0); setUnit("/pax");
    setButtonText("Chat via WA"); setMinPax(1); setMaxPax(6);
    setDuration(""); setLocation(""); setDescription("");
    setFeatures([]); setNewFeature(""); setExclusions("");
    setItinerary(""); setTerms(""); setYoutubeUrl("");
    setImageFiles([]); setImagePreviews([]); setCurrentEditingId(null);
    setCurrentImageUrls([]);
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (pkg: Package) => {
    resetForm();
    setCurrentEditingId(pkg.id);
    setName(pkg.name);
    setSlug(pkg.slug);
    setCategory(pkg.category);
    setStatus(pkg.status);
    setPrice(pkg.price);
    setUnit(pkg.unit);
    setButtonText(pkg.buttonText || "Chat via WA");
    setMinPax(pkg.minPax);
    setMaxPax(pkg.maxPax);
    setDuration(pkg.duration);
    setLocation(pkg.location);
    setDescription(pkg.description);
    setFeatures(pkg.features || []);
    setExclusions(pkg.exclusions);
    setItinerary(pkg.itinerary);
    setTerms(pkg.terms);
    setYoutubeUrl(pkg.youtubeUrl || "");
    // Saat edit, preview menampilkan URL yang sudah tersimpan
    setImagePreviews(pkg.imageUrls || []);
    setCurrentImageUrls(pkg.imageUrls || []);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isFormLoading) return;
    resetForm();
    setIsModalOpen(false);
  };

  // --- Fungsi Form: Fitur (Termasuk) ---
  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  // --- Fungsi Form: Image Preview (Multi-Foto) ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileList = Array.from(files);

      // Gabungkan file yang baru dipilih dengan yang sudah ada (jika sedang edit)
      // atau file yang sudah dipilih sebelumnya (jika tambah baru)
      const combinedFiles = [...imageFiles, ...fileList];

      // Batasi jumlah file
      const limitedFiles = combinedFiles.slice(0, 10);

      // Cek ukuran file baru
      for (const file of fileList) {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
          setToast({ msg: `File "${file.name}" terlalu besar (maks 2 MB).`, type: "error" });
          e.target.value = ''; // Reset input file jika ada yg error
          return;
        }
      }

      // Buat preview baru
      const newPreviews = limitedFiles.map(file => URL.createObjectURL(file));

      setImageFiles(limitedFiles); // Simpan file objeknya
      setImagePreviews(newPreviews); // Simpan URL previewnya

      // Reset input file agar bisa memilih file yang sama lagi
      e.target.value = '';
    }
  };


  // --- Fungsi Hapus Preview Foto ---
  const removeImagePreview = (index: number) => {
    // Hapus file objek
    const updatedFiles = imageFiles.filter((_, i) => i !== index);
    setImageFiles(updatedFiles);

    // Hapus URL preview
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);
    setImagePreviews(updatedPreviews);

    // Hapus juga URL lama jika yang dihapus adalah preview dari URL lama (saat edit)
    if (currentEditingId && index < currentImageUrls.length) {
      const updatedCurrentUrls = currentImageUrls.filter((_, i) => i !== index);
      setCurrentImageUrls(updatedCurrentUrls);
    }
  };


  // --- Fungsi Form: SIMPAN (Create/Update - Multi Foto) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID) { setToast({ msg: "Error: User tidak terautentikasi.", type: "error" }); return; }
    setIsFormLoading(true);

    try {
      let finalImageUrls: string[] = [];

      // 1. Identifikasi URL lama yang masih ada di preview (saat edit)
      const existingUrlsInPreview = imagePreviews.filter(url => url.startsWith('https://firebasestorage.googleapis.com'));

      // 2. Identifikasi File baru yang perlu diupload
      const filesToUpload = imageFiles.filter(file => !existingUrlsInPreview.includes(URL.createObjectURL(file))); // Cek berdasarkan object URL

      // 3. Upload File baru
      if (filesToUpload.length > 0) {
        const uploadPromises = filesToUpload.map(async (file) => {
          const storageRef = ref(storage, `packages/${userUID}/${Date.now()}_${file.name}`);
          const uploadTask = await uploadBytes(storageRef, file);
          return await getDownloadURL(uploadTask.ref);
        });
        const newUploadedUrls = await Promise.all(uploadPromises);
        finalImageUrls = [...existingUrlsInPreview, ...newUploadedUrls]; // Gabungkan URL lama yg tersisa + URL baru
      } else {
        finalImageUrls = existingUrlsInPreview; // Jika tidak ada file baru, pakai URL lama yg tersisa
      }

       // 4. Hapus gambar lama di storage yang TIDAK ADA di `existingUrlsInPreview` (saat edit)
       if (currentEditingId && currentImageUrls.length > 0) {
        const urlsToDelete = currentImageUrls.filter(url => !existingUrlsInPreview.includes(url));
        if (urlsToDelete.length > 0) {
           const deletePromises = urlsToDelete.map(async (url) => {
             try { await deleteObject(ref(storage, url)); }
             catch (err:any) { if (err.code !== 'storage/object-not-found') console.warn("Gagal hapus gambar lama:", err); }
           });
           await Promise.all(deletePromises);
         }
       }

      // 5. Siapkan Data
      const dataToSave = {
        name, slug: slug || createSlug(name), category, status,
        price, unit, buttonText, minPax, maxPax, duration, location,
        description, features, exclusions, itinerary, terms,
        imageUrls: finalImageUrls, // <-- Simpan array URL hasil gabungan
        youtubeUrl: youtubeUrl || "",
        vendorId: userUID,
        updatedAt: serverTimestamp(),
      };

      // 6. Update atau Create
      if (currentEditingId) {
        const docRef = doc(db, "packages", currentEditingId);
        await updateDoc(docRef, dataToSave);
      } else {
        await addDoc(collection(db, "packages"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
      }

      setToast({ msg: "Paket berhasil disimpan!", type: "success" });
      closeModal();

    } catch (err) {
      console.error(err);
      setToast({ msg: "Gagal menyimpan paket.", type: "error" });
    } finally {
      setIsFormLoading(false);
    }
  };

  // --- Fungsi Hapus ---
  const handleDelete = async (pkg: Package) => {
    if (!confirm(`Yakin ingin menghapus paket "${pkg.name}"?`)) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "packages", pkg.id));
      if (pkg.imageUrls && pkg.imageUrls.length > 0) {
        const deletePromises = pkg.imageUrls.map(async (url) => {
           try { await deleteObject(ref(storage, url)); }
           catch (err:any) { if (err.code !== 'storage/object-not-found') console.warn("Gagal hapus gambar:", err); }
        });
        await Promise.all(deletePromises);
      }
      setToast({ msg: "Paket berhasil dihapus.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ msg: "Gagal menghapus paket.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Fungsi Toggle Status Cepat ---
  const handleStatusToggle = async (pkg: Package) => {
    const newStatus = pkg.status === 'active' ? 'draft' : 'active';
    try {
      await updateDoc(doc(db, "packages", pkg.id), { status: newStatus });
      setToast({ msg: `Status diubah ke ${newStatus}`, type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ msg: "Gagal update status.", type: "error" });
    }
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat data..." />}
      {isFormLoading && <Loader text="Menyimpan..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Kelola Paket Trip</h2>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Tambah Paket
        </button>
      </div>

      {/* Konten: Grid Kartu Paket */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map(pkg => (
          <div key={pkg.id} className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden transition-all hover:shadow-2xl">
            {/* Gambar & Status */}
            <div className="relative h-48 bg-gray-200">
              <img
                src={pkg.imageUrls?.[0] || "https://placehold.co/600x400/e2e8f0/94a3b8?text=No+Image"}
                alt={pkg.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleStatusToggle(pkg)}
                title={`Ubah ke ${pkg.status === 'active' ? 'Draft' : 'Aktif'}`}
                className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 ${pkg.status === 'active' ? 'bg-green-600' : 'bg-gray-500'}`}
              >
                {pkg.status === 'active' ? 'Aktif' : 'Draft'}
              </button>
            </div>
            {/* Konten Kartu */}
            <div className="p-5 flex flex-col flex-grow">
              <p className="text-xs font-semibold text-blue-600 uppercase">{pkg.category.replace(/-/g, ' ')}</p>
              <h3 className="text-lg font-bold text-gray-900 mt-1 mb-2 truncate">{pkg.name}</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <i className="fas fa-money-bill-wave fa-fw mr-1.5 w-4 text-center"></i>
                  {pkg.price > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(pkg.price) : "N/A"}
                  <span className="text-gray-500"> {pkg.unit}</span>
                </p>
                <p>
                  <i className="fas fa-comment-dots fa-fw mr-1.5 w-4 text-center"></i>
                  Tombol: {pkg.buttonText || "N/A"}
                </p>
              </div>
              {/* Tombol Aksi */}
              <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
                <button onClick={() => handleEdit(pkg)} className="w-full bg-blue-100 text-blue-700 font-semibold py-2 px-3 rounded-lg hover:bg-blue-200"><i className="fas fa-edit mr-1.5"></i> Edit</button>
                <button onClick={() => handleDelete(pkg)} className="w-full bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-lg hover:bg-red-200"><i className="fas fa-trash mr-1.5"></i> Hapus</button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && packages.length === 0 && (
          <p className="text-center text-gray-500 py-10 col-span-full">
            Belum ada paket trip. Klik "Tambah Paket" untuk memulai.
          </p>
        )}
      </div>

      {/* === MODAL FORM TAMBAH/EDIT === */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div onClick={closeModal} className="absolute inset-0"></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">{currentEditingId ? "Edit Paket Trip" : "Tambah Paket Trip Baru"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times fa-lg"></i></button>
            </div>

            {/* Body Modal (Scrollable) */}
            <form id="addonForm" onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Kolom Kiri */}
                <div className="lg:col-span-8 space-y-6">
                  {/* ... (Info Dasar, Detail, Fitur, Teks Panjang - Sama) ... */}
                   {/* Info Dasar */}
                   <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                        <h3 className="text-lg font-semibold">Info Dasar</h3>
                        <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nama Paket</label>
                        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div>
                        <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                        <input id="slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Kosongkan untuk auto-generate" />
                        </div>
                        <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat</label>
                        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-lg"></textarea>
                        </div>
                    </div>

                    {/* Info Detail */}
                    <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                        <h3 className="text-lg font-semibold">Info Detail</h3>
                        <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Durasi</label>
                            <input id="duration" type="text" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Contoh: 3 Hari 2 Malam" />
                        </div>
                        <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                            <input id="location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Contoh: Dieng, Wonosobo" />
                        </div>
                        <div>
                            <label htmlFor="minPax" className="block text-sm font-medium text-gray-700 mb-1">Min. Pax</label>
                            <input id="minPax" type="number" min="1" value={minPax} onChange={(e) => setMinPax(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg" />
                        </div>
                        <div>
                            <label htmlFor="maxPax" className="block text-sm font-medium text-gray-700 mb-1">Maks. Pax</label>
                            <input id="maxPax" type="number" min="1" value={maxPax} onChange={(e) => setMaxPax(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg" />
                        </div>
                        </div>
                    </div>

                    {/* Fitur (Termasuk) */}
                    <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                        <h3 className="text-lg font-semibold">Termasuk Dalam Paket (Features)</h3>
                        <div className="flex gap-2">
                        <input
                            type="text"
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                            className="flex-grow p-2 border border-gray-300 rounded-lg"
                            placeholder="Contoh: Tiket Masuk Objek Wisata"
                        />
                        <button type="button" onClick={addFeature} className="bg-blue-500 text-white px-4 rounded-lg font-semibold">Add</button>
                        </div>
                        <div className="space-y-2">
                        {features.map((feature, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-lg">
                            <span className="text-sm text-gray-800">{feature}</span>
                            <button type="button" onClick={() => removeFeature(index)} className="text-red-500 hover:text-red-700">
                                <i className="fas fa-trash"></i>
                            </button>
                            </div>
                        ))}
                        {features.length === 0 && <p className="text-sm text-gray-500">Belum ada fitur ditambahkan.</p>}
                        </div>
                    </div>

                    {/* Teks Panjang (Itinerary, dll) */}
                    <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                        <h3 className="text-lg font-semibold">Deskripsi Panjang</h3>
                        <div>
                        <label htmlFor="exclusions" className="block text-sm font-medium text-gray-700 mb-1">Tidak Termasuk (Exclusions)</label>
                        <textarea id="exclusions" value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={4} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Contoh:&#10;- Makan Siang&#10;- Pengeluaran Pribadi"></textarea>
                        </div>
                        <div>
                        <label htmlFor="itinerary" className="block text-sm font-medium text-gray-700 mb-1">Rencana Perjalanan (Itinerary)</label>
                        <textarea id="itinerary" value={itinerary} onChange={(e) => setItinerary(e.target.value)} rows={6} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Hari 1: ...&#10;Hari 2: ..."></textarea>
                        </div>
                        <div>
                        <label htmlFor="terms" className="block text-sm font-medium text-gray-700 mb-1">Syarat & Ketentuan</label>
                        <textarea id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className="w-full p-2 border border-gray-300 rounded-lg"></textarea>
                        </div>
                    </div>
                </div>

                {/* Kolom Kanan */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Pengaturan Harga (Sama) */}
                  <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                    {/* ... (kode harga sama) ... */}
                    <h3 className="text-lg font-semibold">Pengaturan Harga</h3>
                    <div>
                      <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
                      <input id="price" type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg" />
                      <p className="text-xs text-gray-500 mt-1">Isi 0 jika harga tidak ditampilkan.</p>
                    </div>
                    <div>
                      <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                      <input id="unit" type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="/pax, /mobil, dll" />
                    </div>
                    <div>
                      <label htmlFor="buttonText" className="block text-sm font-medium text-gray-700 mb-1">Teks Tombol Harga (Tamu)</label>
                      <input id="buttonText" type="text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Contoh: Chat via WA" />
                    </div>
                  </div>

                  {/* Pengaturan Publish (Sama) */}
                  <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                    {/* ... (kode publish sama) ... */}
                     <h3 className="text-lg font-semibold">Publish</h3>
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                      <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                        <option value="private-wisata-alam">Private - Wisata Alam</option>
                        <option value="open-wisata-alam">Open - Wisata Alam</option>
                        <option value="private-wisata-budaya">Private - Wisata Budaya</option>
                        <option value="open-wisata-budaya">Open - Wisata Budaya</option>
                        <option value="paket-honeymoon">Paket Honeymoon</option>
                        <option value="sewa-kendaraan">Sewa Kendaraan</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select id="status" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'draft')} className="w-full p-2 border border-gray-300 rounded-lg">
                        <option value="active">Aktif (Publish)</option>
                        <option value="draft">Draft (Simpan)</option>
                      </select>
                    </div>
                  </div>

                  {/* --- Galeri Foto --- */}
                  <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                    <h3 className="text-lg font-semibold">Galeri Foto (Maks 10)</h3>
                    {/* Preview */}
                    <div className="grid grid-cols-3 gap-2">
                       {imagePreviews.map((previewUrl, index) => (
                        <div key={index} className="relative group aspect-video"> {/* aspect-video agar kotak */}
                          <img
                            src={previewUrl}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImagePreview(index)}
                            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                            aria-label="Hapus gambar"
                          >
                            &times;
                          </button>
                        </div>
                       ))}
                       {/* Placeholder jika belum 10 */}
                       {imagePreviews.length < 10 && (
                          <label htmlFor="addonImages" className="cursor-pointer aspect-video flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-500">
                             <i className="fas fa-plus fa-lg"></i>
                           </label>
                       )}
                    </div>
                    {/* Input File */}
                    <input
                      id="addonImages"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleImageChange}
                      disabled={imagePreviews.length >= 10}
                      className="hidden" // Sembunyikan input asli
                    />
                     {imagePreviews.length >= 10 && (
                       <p className="text-xs text-red-600">Batas maksimal 10 foto tercapai.</p>
                     )}
                  </div>

                  {/* --- Input YouTube --- */}
                   <div className="p-5 rounded-lg border border-gray-200 space-y-4">
                    <h3 className="text-lg font-semibold">Video YouTube (Opsional)</h3>
                    <div>
                      <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-700 mb-1">URL Video YouTube</label>
                      <input
                        id="youtubeUrl"
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        placeholder="Contoh: https://www.youtube.com/watch?v=..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer Modal */}
            <div className="flex items-center justify-end p-5 border-t border-gray-200 sticky bottom-0 bg-gray-50 rounded-b-2xl">
              {/* ... (kode footer sama) ... */}
              <button
                onClick={closeModal}
                type="button"
                className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-lg border border-gray-300 mr-3 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="addonForm" // Hubungkan ke form
                disabled={isFormLoading}
                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isFormLoading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                {currentEditingId ? "Update Paket" : "Simpan Paket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

