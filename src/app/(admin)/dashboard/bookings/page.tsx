// Ini adalah file: app/admin/dashboard/bookings/page.tsx
// Halaman untuk melihat dan mengelola semua pesanan (VERSI 5 - Filter Tanggal & Export PDF)
"use client";

import { useState, useEffect, useCallback, useMemo, JSX } from "react"; // Tambah useMemo
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  serverTimestamp,
  where, // <-- IMPORT where
  QueryConstraint // <-- IMPORT QueryConstraint
} from "firebase/firestore";
// --- Import Library PDF ---
import jsPDF from 'jspdf';
import 'jspdf-autotable';
// Deklarasikan tipe tambahan untuk jsPDF-AutoTable (karena library-nya mungkin tidak punya tipe default)
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}


// --- Komponen Toast & Loader (Sama) ---
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error' | 'info'; onDone: () => void; }) {
  useEffect(() => { const timer = setTimeout(onDone, 3000); return () => clearTimeout(timer); }, [onDone]);
  let bgColor = 'bg-gray-800'; let icon = 'fa-info-circle';
  if (type === 'success') { bgColor = 'bg-green-600'; icon = 'fa-check-circle'; } if (type === 'error') { bgColor = 'bg-red-600'; icon = 'fa-exclamation-circle'; }
  return ( <div className={`fixed top-5 left-1/2 -translate-x-1/2 flex items-center gap-3 p-4 rounded-lg shadow-xl text-white ${bgColor} z-[70]`}><i className={`fas ${icon}`}></i><span>{message}</span></div> );
}
function Loader({ text = "Memuat..." }: { text?: string; }) {
  return ( <div className="fixed inset-0 bg-white/80 z-[60] flex items-center justify-center"><div className="flex flex-col items-center"><div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div><p className="mt-2 text-gray-700 font-semibold">{text}</p></div></div> );
}
// --- END Komponen ---

// --- Tipe Data Booking (Sama) ---
interface Booking extends Record<string, any> { /* ... definisi tipe sama ... */
    id: string;
    guestName: string; guestPhone: string; guestEmail?: string;
    packageId: string; packageName: string; pax: number; tripDate: string;
    totalAmount: number; paymentStatus: 'pending' | 'paid' | 'cancelled';
    notes?: string; source: 'manual' | 'website'; createdAt: Timestamp;
    customDuration?: string; customLocation?: string; customFeatures?: string;
    customExclusions?: string; customItinerary?: string; ref?: string;
}

// --- Helper Format Tanggal & Mata Uang (Sama) ---
const formatDate = (dateString: string | Timestamp | undefined, includeTime = true) => { // Tambah opsi includeTime
    if (!dateString) return '-';
    try {
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        if (typeof (dateString as Timestamp)?.toDate === 'function') {
            return (dateString as Timestamp).toDate().toLocaleDateString('id-ID', options);
        }
        if (typeof dateString === 'string' && dateString.length === 10 && dateString.includes('-')) {
            const [year, month, day] = dateString.split('-').map(Number);
            const utcDate = new Date(Date.UTC(year, month - 1, day));
             // Untuk tripDate, jangan tampilkan waktu
             options.hour = undefined; options.minute = undefined;
            return utcDate.toLocaleDateString('id-ID', options);
        }
        return new Date(dateString as string).toLocaleDateString('id-ID', options);
    } catch (e) { console.error("Error formatting date:", dateString, e); return '-'; }
};
const formatCurrency = (amount: number | undefined) => { /* ... kode sama ... */
    if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};
const getStatusBadge = (status: 'pending' | 'paid' | 'cancelled') => { /* ... kode sama ... */
    switch (status) {
        case 'paid': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Paid</span>;
        case 'cancelled': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Cancelled</span>;
        case 'pending': default: return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
    }
};


// === Komponen Modal Detail Pesanan (Sama) ===
function BookingDetailModal({ booking, onClose, onStatusChange, isUpdating, statusBadgeRenderer }: { /* ... props sama ... */
    booking: Booking | null;
    onClose: () => void;
    onStatusChange: (bookingId: string, newStatus: 'pending' | 'paid' | 'cancelled') => void;
    isUpdating: string | null;
    statusBadgeRenderer: (status: 'pending' | 'paid' | 'cancelled') => JSX.Element;
}) {
     /* ... kode modal sama ... */
    if (!booking) return null;
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) { onClose(); } };
    const isProcessing = isUpdating === booking.id;
    const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => ( <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4"> <dt className="text-sm font-medium text-gray-500">{label}</dt> <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || '-'}</dd> </div> );
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300" onClick={handleBackdropClick}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-modal-pop-in">
                <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10"> <h2 className="text-xl font-bold text-gray-900">Detail Pesanan #{booking.id.substring(0, 6)}...</h2> <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times fa-lg"></i></button> </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-6 text-sm">
                    <div> <h4 className="font-semibold mb-2 text-gray-700 text-base border-b pb-1"> <i className="fas fa-user mr-2 text-blue-500"></i> Info Tamu</h4> <dl className="divide-y divide-gray-100"> <DetailItem label="Nama" value={booking.guestName} /> <DetailItem label="Telepon/WA" value={booking.guestPhone} /> {booking.guestEmail && <DetailItem label="Email" value={booking.guestEmail} />} </dl> </div>
                    <div> <h4 className="font-semibold mb-2 text-gray-700 text-base border-b pb-1"> <i className="fas fa-box-archive mr-2 text-green-500"></i> Info Paket</h4> <dl className="divide-y divide-gray-100"> <DetailItem label="Paket" value={<>{booking.packageName} {booking.packageId === 'custom' && <span className="text-xs text-blue-600">(Custom)</span>}</>} /> <DetailItem label="Jumlah Pax" value={booking.pax} /> <DetailItem label="Tanggal Trip" value={formatDate(booking.tripDate, false)} /> {booking.packageId === 'custom' && ( <> {booking.customDuration && <DetailItem label="Durasi Custom" value={booking.customDuration} />} {booking.customLocation && <DetailItem label="Lokasi Custom" value={booking.customLocation} />} {booking.customFeatures && <DetailItem label="Features Custom" value={<pre className="whitespace-pre-wrap font-sans bg-gray-50 p-2 rounded text-xs border border-gray-200">{booking.customFeatures}</pre>} />} {booking.customExclusions && <DetailItem label="Exclusions Custom" value={<pre className="whitespace-pre-wrap font-sans bg-gray-50 p-2 rounded text-xs border border-gray-200">{booking.customExclusions}</pre>} />} {booking.customItinerary && <DetailItem label="Itinerary Custom" value={<pre className="whitespace-pre-wrap font-sans bg-gray-50 p-2 rounded text-xs border border-gray-200">{booking.customItinerary}</pre>} />} </> )} </dl> </div>
                    <div> <h4 className="font-semibold mb-2 text-gray-700 text-base border-b pb-1"> <i className="fas fa-dollar-sign mr-2 text-yellow-500"></i> Pembayaran & Lainnya</h4> <dl className="divide-y divide-gray-100"> <DetailItem label="Total Harga" value={formatCurrency(booking.totalAmount)} /> <DetailItem label="Status Bayar" value={statusBadgeRenderer(booking.paymentStatus)} /> <DetailItem label="Sumber Pesanan" value={<span className="capitalize">{booking.source}</span>} /> {booking.ref && <DetailItem label="Referral" value={booking.ref} />} <DetailItem label="Tanggal Pesan" value={formatDate(booking.createdAt, true)} /> {booking.notes && <DetailItem label="Catatan" value={<p className="whitespace-pre-wrap bg-yellow-50 p-2 rounded border border-yellow-200 text-gray-700">{booking.notes}</p>} />} </dl> </div>
                </div>
                <div className="flex items-center justify-between p-5 border-t border-gray-200 sticky bottom-0 bg-gray-50 rounded-b-xl z-10"> {booking.paymentStatus !== 'cancelled' && ( <button onClick={() => onStatusChange(booking.id, 'cancelled')} disabled={isProcessing} className="bg-red-100 text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"> {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-times-circle"></i>} Batalkan Pesanan Ini </button> )} {booking.paymentStatus === 'cancelled' && <div></div>} <button onClick={onClose} type="button" disabled={isProcessing} className="bg-white text-gray-700 font-semibold py-2 px-4 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all disabled:opacity-50"> Tutup </button> </div>
            </div> <style jsx global>{` @keyframes modal-pop-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-modal-pop-in { animation: modal-pop-in 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; } `}</style>
        </div>
    );
}
// === END Komponen Modal ===

// === Tipe Filter Tanggal ===
type DateFilterType = 'all' | 'month' | 'week' | 'year' | 'custom';

// === Halaman Kelola Pesanan ===
export default function ManageBookingsPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // --- State BARU untuk Filter Tanggal ---
  const [filterType, setFilterType] = useState<DateFilterType>('all');
  const [startDate, setStartDate] = useState(''); // Format YYYY-MM-DD
  const [endDate, setEndDate] = useState('');   // Format YYYY-MM-DD

  const bookingsCollectionRef = collection(db, "bookings");

  // --- Cek Auth & Ambil Data Awal (Dengan Filter) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => { if (user) setUserUID(user.uid); else router.push("/admin"); });

    let unsubscribeSnapshot = () => {};
    if (userUID) {
      // Selalu set loading saat filter berubah atau user berubah
      setIsLoading(true);

      // --- Logika Query dengan Filter ---
      const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")]; // Urutan default

      const now = new Date();
      let startFilterDate: Date | null = null;
      let endFilterDate: Date | null = null;

      if (filterType === 'month') {
          startFilterDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endFilterDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // Akhir bulan
      } else if (filterType === 'week') {
          const firstDayOfWeek = now.getDate() - now.getDay(); // Asumsi Minggu = 0
          startFilterDate = new Date(now.getFullYear(), now.getMonth(), firstDayOfWeek);
          endFilterDate = new Date(now.getFullYear(), now.getMonth(), firstDayOfWeek + 6, 23, 59, 59); // Akhir minggu
      } else if (filterType === 'year') {
          startFilterDate = new Date(now.getFullYear(), 0, 1); // Awal tahun
          endFilterDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // Akhir tahun
      } else if (filterType === 'custom' && startDate && endDate) {
          startFilterDate = new Date(startDate);
          // Tambah 1 hari ke end date agar inklusif sampai akhir hari
          endFilterDate = new Date(endDate);
          endFilterDate.setDate(endFilterDate.getDate() + 1);
          // Set ke awal hari start dan akhir hari end
          startFilterDate.setHours(0,0,0,0);
          endFilterDate.setHours(0,0,0,0); // Akhir hari = awal hari berikutnya
      }

      // Tambahkan constraint 'where' jika ada filter tanggal
      if (startFilterDate && endFilterDate) {
          constraints.push(where("createdAt", ">=", Timestamp.fromDate(startFilterDate)));
          constraints.push(where("createdAt", "<", Timestamp.fromDate(endFilterDate))); // Gunakan '<' untuk akhir hari
          console.log("Filtering by date:", startFilterDate, endFilterDate);
      } else {
          console.log("No date filter applied.");
      }

      // Buat query gabungan
      const q = query(bookingsCollectionRef, ...constraints);
      // --- END Logika Query ---

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        // PERBAIKAN: Langsung terapkan tipe Booking saat mapping data dari snapshot
        const bookingsData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        } as Booking)); // <-- Type Assertion di sini

        // DEBUG LOGS (Yang menyebabkan error di baris 217)
        // Dihapus karena sudah tidak relevan dan membebani kompilasi
        
        setBookings(bookingsData);
        setIsLoading(false);
      }, (error: any) => { // Tangkap error query
          console.error("Gagal ambil pesanan:", error);
          if (error.code === 'failed-precondition') {
             const linkMatch = error.message.match(/https?:\/\/[^\s]+/);
             const indexLink = linkMatch ? linkMatch[0] : null;
             console.error("Firestore index missing. Create index at:", indexLink);
             setToast({ msg: `Index Firestore (createdAt) belum ada. Klik link di console (F12) untuk membuatnya.`, type: "error" });
          } else {
             setToast({ msg: "Gagal memuat pesanan.", type: "error" });
          }
          setIsLoading(false);
      });
    } else setIsLoading(false);

    return () => { unsubscribeAuth(); unsubscribeSnapshot(); };
  // Tambahkan filterType, startDate, endDate sebagai dependency
  }, [router, userUID, filterType, startDate, endDate]);


  // --- Fungsi Update Status Pembayaran (Sama) ---
  const handleStatusChange = useCallback(async (bookingId: string, newStatus: 'pending' | 'paid' | 'cancelled') => { /* ... kode sama ... */
    if (newStatus === 'cancelled' && !confirm('Yakin ingin membatalkan pesanan ini? Status akan diubah menjadi Cancelled.')) return;
    setIsUpdating(bookingId); setToast(null);
    try {
      const docRef = doc(db, "bookings", bookingId);
      await updateDoc(docRef, { paymentStatus: newStatus, updatedAt: serverTimestamp() });
      setToast({ msg: `Status diubah ke ${newStatus}.`, type: "info" });
      if (selectedBooking?.id === bookingId) setSelectedBooking(null);
    } catch (error: any) { console.error("Gagal update status:", error); setToast({ msg: `Gagal update status: ${error.message || error.code}`, type: "error" }); }
    finally { setIsUpdating(null); }
  }, [selectedBooking]);

  // --- Fungsi Hapus Booking (Sama) ---
  const handleDelete = async (booking: Booking, event: React.MouseEvent) => { /* ... kode sama ... */
    event.stopPropagation();
    if (!confirm(`Yakin ingin menghapus pesanan dari "${booking.guestName}" (${booking.packageName})?`)) return;
    setIsUpdating(booking.id); setToast(null);
    try {
      await deleteDoc(doc(db, "bookings", booking.id));
      setToast({ msg: "Pesanan berhasil dihapus.", type: "success" });
    } catch (error: any) { console.error("Gagal hapus pesanan:", error); setToast({ msg: `Gagal menghapus: ${error.message || error.code}`, type: "error" }); }
    finally { setIsUpdating(null); }
  };

  // --- Fungsi BARU: Export PDF ---
   const handleExportPdf = () => {
        console.log("Exporting PDF...");
        const doc = new jsPDF();
        const tableColumn = ["Tgl Pesan", "Tamu", "Paket", "Pax", "Tgl Trip", "Total", "Status"];
        const tableRows: any[][] = []; // Gunakan any[] untuk fleksibilitas

        // Filter data sesuai tampilan saat ini
        bookings.forEach(booking => {
            const bookingData = [
                formatDate(booking.createdAt, false), // Tgl Pesan tanpa waktu
                `${booking.guestName}\n${booking.guestPhone}`, // Gabung Nama & Telp
                booking.packageName,
                booking.pax,
                formatDate(booking.tripDate, false), // Tgl Trip tanpa waktu
                formatCurrency(booking.totalAmount),
                booking.paymentStatus.toUpperCase() // Status simple text
            ];
            tableRows.push(bookingData);
        });

        // Judul Dokumen
        doc.setFontSize(18);
        doc.text("Laporan Pesanan Asoka Trip", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        // Tambahkan info filter jika ada
        let filterInfo = "Filter: Semua";
        if (filterType === 'month') filterInfo = "Filter: Bulan Ini";
        else if (filterType === 'week') filterInfo = "Filter: Minggu Ini";
        else if (filterType === 'year') filterInfo = "Filter: Tahun Ini";
        else if (filterType === 'custom' && startDate && endDate) filterInfo = `Filter: ${startDate} s/d ${endDate}`;
        doc.text(filterInfo, 14, 30);


        // Generate Tabel
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35, // Mulai tabel setelah judul
            theme: 'grid', // Tema tabel (striped, grid, plain)
            headStyles: { fillColor: [22, 160, 133] }, // Warna header (biru)
            styles: { fontSize: 8 },
            columnStyles: { // Atur lebar kolom jika perlu
                0: { cellWidth: 20 }, // Tgl Pesan
                1: { cellWidth: 40 }, // Tamu
                2: { cellWidth: 'auto'}, // Paket
                3: { cellWidth: 10 }, // Pax
                4: { cellWidth: 20 }, // Tgl Trip
                5: { cellWidth: 25 }, // Total
                6: { cellWidth: 15 }, // Status
            }
        });

        // Tambah tanggal export
        const date = new Date();
        const dateStr = date.toLocaleDateString('id-ID') + ' ' + date.toLocaleTimeString('id-ID');
        doc.setFontSize(8);
        doc.text(`Diekspor pada: ${dateStr}`, 14, doc.internal.pageSize.height - 10);

        // Simpan file
        doc.save(`laporan_pesanan_asoka_${filterType}_${Date.now()}.pdf`);
        console.log("PDF generated.");
        setToast({ msg: "PDF berhasil dibuat!", type: "success" });
    };


  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat pesanan..." />}
      {isUpdating && <Loader text="Memproses..." />}

      {/* Header Halaman (Ditambah Tombol Export) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer"><i className="fas fa-arrow-left mr-2"></i>Kembali</span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Kelola Pesanan</h2>
        </div>
         <div className="flex items-center gap-3">
             {/* Tombol Export PDF */}
             <button
                onClick={handleExportPdf}
                disabled={isLoading || bookings.length === 0} // Disable jika loading atau tidak ada data
                className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
               <i className="fas fa-file-pdf"></i> Ekspor PDF
             </button>
             {/* Tombol Input Manual */}
             <Link href="/admin/dashboard/input-booking">
                 <span className="bg-yellow-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-all flex items-center gap-2 text-sm">
                   <i className="fas fa-cart-plus"></i> Input Manual
                 </span>
            </Link>
        </div>
      </div>

       {/* --- Filter Tanggal --- */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow border border-gray-100 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium mr-2">Filter Tanggal:</span>
        <button onClick={() => setFilterType('all')} className={`px-3 py-1 rounded-full ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Semua</button>
        <button onClick={() => setFilterType('month')} className={`px-3 py-1 rounded-full ${filterType === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Bulan Ini</button>
        <button onClick={() => setFilterType('week')} className={`px-3 py-1 rounded-full ${filterType === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Minggu Ini</button>
        <button onClick={() => setFilterType('year')} className={`px-3 py-1 rounded-full ${filterType === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Tahun Ini</button>
        <button onClick={() => setFilterType('custom')} className={`px-3 py-1 rounded-full ${filterType === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Custom</button>
        {/* Input Custom Date */}
        {filterType === 'custom' && (
            <div className="flex items-center gap-2 ml-auto sm:ml-2 mt-2 sm:mt-0 border-l pl-3">
                 <input
                     type="date"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     className="p-1 border border-gray-300 rounded text-xs"
                 />
                 <span>s/d</span>
                  <input
                     type="date"
                     value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                     className="p-1 border border-gray-300 rounded text-xs"
                 />
            </div>
        )}
      </div>

      {/* Konten Utama: Tabel Pesanan */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
         <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  {/* ... header tabel sama ... */}
                   <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Pesan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tamu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Trip</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Bayar</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-500">Memuat...</td></tr>
                  ) : bookings.length > 0 ? (
                    bookings.map(b => (
                    <tr
                       key={b.id}
                       onClick={() => setSelectedBooking(b)} // Buka modal
                       className={`hover:bg-gray-100 transition-colors cursor-pointer ${isUpdating === b.id ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(b.createdAt, true)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{b.guestName}</div>
                        <div className="text-sm text-gray-500">{b.guestPhone}</div>
                      </td>
                      <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{b.packageName}</div>
                          <div className="text-sm text-gray-500">{b.pax} Pax</div>
                          {b.packageId === 'custom' && <span className="text-xs text-blue-600">(Custom)</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(b.tripDate, false)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatCurrency(b.totalAmount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Select ubah status */}
                        <select
                          value={b.paymentStatus}
                          onClick={(e) => e.stopPropagation()} // Stop klik row
                          onChange={(e) => handleStatusChange(b.id, e.target.value as any)}
                          disabled={isUpdating === b.id}
                          className={`text-xs p-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                              b.paymentStatus === 'paid' ? 'border-green-300 bg-green-50 text-green-800' :
                              b.paymentStatus === 'cancelled' ? 'border-red-300 bg-red-50 text-red-800' :
                              'border-yellow-300 bg-yellow-50 text-yellow-800'
                          }`}
                        >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                         {/* Tombol Hapus */}
                         <button
                           onClick={(e) => handleDelete(b, e)} // Kirim event
                           disabled={isUpdating === b.id}
                           className="text-red-600 hover:text-red-900 disabled:opacity-50 p-1"
                           title="Hapus Pesanan"
                         >
                          <i className="fas fa-trash"></i>
                         </button>
                         {/* Indikator Detail */}
                          <span className="text-blue-600 inline-block p-1" title="Klik baris untuk detail">
                             <i className="fas fa-eye"></i>
                          </span>
                      </td>
                    </tr>
                  ))) : (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-500">
                        {filterType === 'all' ? 'Belum ada pesanan.' : 'Tidak ada pesanan pada rentang tanggal ini.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
         </div>
      </div>

       {/* === Tampilkan Modal Detail === */}
       <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={handleStatusChange}
          isUpdating={isUpdating}
          statusBadgeRenderer={getStatusBadge} // <-- Kirim fungsi helper ke modal
       />
    </>
  );
}
