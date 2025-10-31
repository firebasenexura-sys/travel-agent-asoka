// Ini adalah file BARU: app/admin/dashboard/input-booking/page.tsx
// Halaman untuk input pesanan manual
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  // --- PASTIKAN 'where' SUDAH DI-IMPORT ---
  where,
  onSnapshot,
  doc,
  addDoc,
  Timestamp, // Import Timestamp
  orderBy,
  serverTimestamp,
  getDocs // Untuk fetch paket
} from "firebase/firestore";

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

// --- Tipe Data untuk Paket (untuk dropdown) ---
interface PackageOption {
  id: string;
  name: string;
  price?: number; // Opsional
  unit?: string;
  // Tambahkan field lain jika perlu untuk kalkulasi
}

// --- Tipe Data untuk Booking (Ditambah Detail Custom) ---
interface BookingData {
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    packageId: string; // ID paket yang dipilih, atau 'custom'
    packageName: string; // Nama paket (dari dropdown atau input custom)
    pax: number;
    tripDate: string; // Format YYYY-MM-DD
    totalAmount: number;
    paymentStatus: 'pending' | 'paid' | 'cancelled';
    notes?: string;
    source: 'manual'; // Sumber booking
    createdAt: Timestamp;
    // --- Field Detail Custom (Opsional) ---
    customDuration?: string;
    customLocation?: string;
    customFeatures?: string; // Simpan sebagai teks multiline
    customExclusions?: string; // Simpan sebagai teks multiline
    customItinerary?: string; // Simpan sebagai teks multiline
}


// === Halaman Input Booking ===
export default function InputBookingPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Hanya loading saat simpan
  const [isFetchingPackages, setIsFetchingPackages] = useState(true); // Loading paket
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk Data Paket (Dropdown) ===
  const [packageOptions, setPackageOptions] = useState<PackageOption[]>([]);

  // === State untuk Form Booking (Ditambah Detail Custom) ===
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState(""); // Bisa ID atau 'custom'
  const [customPackageName, setCustomPackageName] = useState("");
  const [pax, setPax] = useState(1);
  const [tripDate, setTripDate] = useState(""); // Format YYYY-MM-DD
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'cancelled'>("pending");
  const [notes, setNotes] = useState("");
  // State Detail Custom
  const [customDuration, setCustomDuration] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [customFeatures, setCustomFeatures] = useState("");
  const [customExclusions, setCustomExclusions] = useState("");
  const [customItinerary, setCustomItinerary] = useState("");

  // Referensi ke koleksi Firestore
  const bookingsCollectionRef = collection(db, "bookings");
  const packagesCollectionRef = collection(db, "packages");

  // --- Cek Auth & Ambil Data Paket ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUID(user.uid);
        fetchPackages(); // Panggil fetch setelah user login
      } else {
        router.push("/admin"); // Tendang jika tidak login
      }
    });

    const fetchPackages = async () => {
        setIsFetchingPackages(true);
        console.log("Fetching packages...");
        try {
            const q = query(packagesCollectionRef, where("status", "==", "active"), orderBy("name", "asc"));
            const snapshot = await getDocs(q);
            console.log(`Found ${snapshot.docs.length} active packages.`);
            const options = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || "Tanpa Nama",
                price: doc.data().price || 0,
                unit: doc.data().unit || "",
            } as PackageOption));
            setPackageOptions(options);
        } catch (error: any) {
            console.error("Gagal mengambil data paket:", error);
            if (error.code === 'failed-precondition') {
                 const linkMatch = error.message.match(/https?:\/\/[^\s]+/);
                 const indexLink = linkMatch ? linkMatch[0] : null;
                 console.error("Firestore index missing. Create index at:", indexLink);
                 setToast({ msg: `Index Firestore belum ada. Klik link di console (F12) untuk membuatnya.`, type: "error" });
            } else {
                setToast({ msg: "Gagal memuat daftar paket.", type: "error" });
            }
        } finally {
            setIsFetchingPackages(false);
            console.log("Finished fetching packages.");
        }
    };

    return () => unsubscribeAuth();
  }, [router]);


   // --- Efek untuk Kalkulasi Harga Otomatis ---
   useEffect(() => {
      if (selectedPackageId !== 'custom') {
        const selectedPackage = packageOptions.find(p => p.id === selectedPackageId);
        if (selectedPackage?.price && selectedPackage.unit?.toLowerCase().includes('pax')) {
            setTotalAmount(selectedPackage.price * pax);
        } else if (selectedPackage?.price) {
            setTotalAmount(selectedPackage.price);
        } else {
            setTotalAmount(0);
        }
      }
  }, [selectedPackageId, pax, packageOptions]);


  // --- Fungsi Reset Form (Ditambah Detail Custom) ---
  const resetFormFields = () => {
      setGuestName(""); setGuestPhone(""); setGuestEmail("");
      setSelectedPackageId(""); setCustomPackageName(""); setPax(1); setTripDate("");
      setTotalAmount(0); setPaymentStatus("pending"); setNotes("");
      setCustomDuration(""); setCustomLocation(""); setCustomFeatures("");
      setCustomExclusions(""); setCustomItinerary("");
  }

  // --- Fungsi Simpan Booking (Ditambah Detail Custom) ---
  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID || !guestName || !guestPhone || !selectedPackageId || !tripDate) {
       setToast({ msg: "Nama, Telepon, Paket/Custom, dan Tanggal Trip wajib diisi.", type: "error" });
       return;
    }
    if (selectedPackageId === 'custom' && !customPackageName) {
        setToast({ msg: "Nama Paket Custom wajib diisi.", type: "error" });
        return;
    }
     if (selectedPackageId === 'custom' && totalAmount <= 0) {
        setToast({ msg: "Total Harga untuk paket custom wajib diisi (lebih dari 0).", type: "error" });
        return;
    }

    setIsLoading(true);
    setToast(null);

    let finalPackageName = "";
    if (selectedPackageId === 'custom') {
        finalPackageName = customPackageName;
    } else {
        const selectedPackage = packageOptions.find(p => p.id === selectedPackageId);
        if (!selectedPackage) { /* ... error handling ... */ return; }
        finalPackageName = selectedPackage.name;
    }


    // Siapkan Data Booking (dengan detail custom jika ada)
    const bookingData: BookingData = {
      guestName, guestPhone, guestEmail: guestEmail || "",
      packageId: selectedPackageId, packageName: finalPackageName,
      pax, tripDate, totalAmount, paymentStatus, notes: notes || "",
      source: 'manual', createdAt: serverTimestamp() as Timestamp,
      // Tambahkan detail custom HANYA jika paketnya custom
      ...(selectedPackageId === 'custom' && {
          customDuration, customLocation, customFeatures,
          customExclusions, customItinerary
      })
    };

    try {
      const docRef = await addDoc(bookingsCollectionRef, bookingData);
      console.log("Booking baru ditambahkan:", docRef.id);
      setToast({ msg: "Pesanan berhasil ditambahkan!", type: "success" });
      resetFormFields(); // Panggil fungsi reset

    } catch (error: any) {
      console.error("Gagal menyimpan pesanan:", error);
      setToast({ msg: `Gagal menyimpan: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Menyimpan pesanan..." />}
      {isFetchingPackages && packageOptions.length === 0 && <Loader text="Memuat paket..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Input Pesanan Manual</h2>
        </div>
      </div>

      {/* Form Utama */}
      <form onSubmit={handleSaveBooking} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-6">
          <i className="fas fa-cart-plus mr-2 text-yellow-500"></i> Detail Pesanan Baru
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informasi Tamu */}
            <div className="md:col-span-2 space-y-4 p-4 border border-gray-100 rounded-lg bg-gray-50/50">
                 {/* ... (kode info tamu sama) ... */}
                 <h4 className="text-md font-semibold text-gray-700 mb-2">Informasi Tamu</h4>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div>
                        <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-1">Nama Tamu</label>
                        <input id="guestName" type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-white focus:border-blue-500 focus:ring-blue-500" />
                     </div>
                     <div>
                        <label htmlFor="guestPhone" className="block text-sm font-medium text-gray-700 mb-1">No. Telepon/WA</label>
                        <input id="guestPhone" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-white focus:border-blue-500 focus:ring-blue-500" placeholder="+62..." />
                     </div>
                      <div>
                        <label htmlFor="guestEmail" className="block text-sm font-medium text-gray-700 mb-1">Email (Opsional)</label>
                        <input id="guestEmail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-white focus:border-blue-500 focus:ring-blue-500" />
                     </div>
                 </div>
            </div>

             {/* Detail Trip */}
            <div className="space-y-4">
                 <h4 className="text-md font-semibold text-gray-700 mb-2">Detail Trip</h4>
                {/* --- Dropdown Paket --- */}
                <div>
                  <label htmlFor="selectedPackageId" className="block text-sm font-medium text-gray-700 mb-1">Pilih Paket Trip</label>
                  <select
                    id="selectedPackageId" value={selectedPackageId}
                    onChange={(e) => {
                        const value = e.target.value;
                        setSelectedPackageId(value);
                        if (value !== 'custom') { setCustomPackageName(""); }
                         // Reset detail custom jika memilih paket standar
                        setCustomDuration(""); setCustomLocation(""); setCustomFeatures("");
                        setCustomExclusions(""); setCustomItinerary("");
                    }}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-white"
                    disabled={isFetchingPackages && packageOptions.length === 0}
                  >
                    <option value="" disabled>{isFetchingPackages && packageOptions.length === 0 ? "Memuat..." : "-- Pilih Paket --"}</option>
                    <option value="custom">-- Paket Custom --</option>
                    {packageOptions.map(pkg => ( <option key={pkg.id} value={pkg.id}>{pkg.name} {pkg.price ? `(...)` : ''}</option> ))}
                  </select>
                   {!isFetchingPackages && packageOptions.length === 0 && ( <p className="text-xs text-red-500 mt-1">...</p> )}
                </div>

                {/* --- Input Detail Custom (Conditional) --- */}
                {selectedPackageId === 'custom' && (
                    <div className="space-y-4 p-4 border border-blue-100 rounded-lg bg-blue-50/30">
                        <h5 className="text-sm font-semibold text-blue-800">Detail Paket Custom</h5>
                        <div>
                            <label htmlFor="customPackageName" className="block text-xs font-medium text-gray-600 mb-1">Nama Paket Custom*</label>
                            <input id="customPackageName" type="text" value={customPackageName} onChange={(e) => setCustomPackageName(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm" />
                        </div>
                         <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label htmlFor="customDuration" className="block text-xs font-medium text-gray-600 mb-1">Durasi</label>
                                <input id="customDuration" type="text" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm" placeholder="Contoh: 2 Hari 1 Malam"/>
                             </div>
                             <div>
                                <label htmlFor="customLocation" className="block text-xs font-medium text-gray-600 mb-1">Lokasi</label>
                                <input id="customLocation" type="text" value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm" placeholder="Contoh: Dieng & Sekitarnya"/>
                             </div>
                         </div>
                         <div>
                            <label htmlFor="customFeatures" className="block text-xs font-medium text-gray-600 mb-1">Termasuk (Features)</label>
                            <textarea id="customFeatures" value={customFeatures} onChange={(e) => setCustomFeatures(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm" placeholder="Satu item per baris..."></textarea>
                         </div>
                          <div>
                            <label htmlFor="customExclusions" className="block text-xs font-medium text-gray-600 mb-1">Tidak Termasuk (Exclusions)</label>
                            <textarea id="customExclusions" value={customExclusions} onChange={(e) => setCustomExclusions(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm" placeholder="Satu item per baris..."></textarea>
                         </div>
                         <div>
                            <label htmlFor="customItinerary" className="block text-xs font-medium text-gray-600 mb-1">Itinerary Singkat</label>
                            <textarea id="customItinerary" value={customItinerary} onChange={(e) => setCustomItinerary(e.target.value)} rows={4} className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm" placeholder="Hari 1: ...&#10;Hari 2: ..."></textarea>
                         </div>
                    </div>
                )}

                 {/* --- Input Pax & Tanggal --- */}
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="pax" className="block text-sm font-medium text-gray-700 mb-1">Jumlah Pax</label>
                        <input id="pax" type="number" min="1" value={pax} onChange={(e) => setPax(Number(e.target.value))} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                     </div>
                      <div>
                        <label htmlFor="tripDate" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Trip</label>
                        <input id="tripDate" type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                     </div>
                 </div>
            </div>

            {/* Pembayaran & Catatan */}
            <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Pembayaran & Catatan</h4>
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">Total Harga (Rp)</label>
                        <input
                          id="totalAmount" type="number" min="0" value={totalAmount}
                          onChange={(e) => setTotalAmount(Number(e.target.value))} required
                          // Jika custom, buat bisa diedit (bg-white), jika tidak bg-gray-50
                          className={`w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 ${selectedPackageId === 'custom' ? 'bg-white' : 'bg-gray-50'}`}
                        />
                         <p className="text-xs text-gray-500 mt-1">
                            {selectedPackageId === 'custom' ? 'Wajib diisi manual.' : 'Otomatis terisi, bisa diedit.'}
                        </p>
                     </div>
                     <div>
                        <label htmlFor="paymentStatus" className="block text-sm font-medium text-gray-700 mb-1">Status Pembayaran</label>
                        <select
                          id="paymentStatus" value={paymentStatus}
                          onChange={(e) => setPaymentStatus(e.target.value as 'pending' | 'paid' | 'cancelled')} required
                          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-white"
                        >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                     </div>
                 </div>
                 <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Catatan (Opsional)</label>
                    <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={selectedPackageId === 'custom' ? 2 : 5} // Buat lebih kecil jika custom aktif
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm" placeholder="Catatan tambahan..."></textarea>
                 </div>
            </div>
        </div>

        {/* Tombol Simpan */}
        <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isLoading || (isFetchingPackages && packageOptions.length === 0 && selectedPackageId !== 'custom')}
            className="bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            Simpan Pesanan
          </button>
        </div>

      </form>
    </>
  );
}

