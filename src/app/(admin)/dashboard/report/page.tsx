// Ini adalah file BARU: app/admin/dashboard/report/page.tsx
// Halaman untuk menampilkan laporan pendapatan dan statistik
"use client";

// --- TAMBAHKAN useCallback DI SINI ---
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  orderBy,
  where,
  QueryConstraint,
  getDocs // <-- Gunakan getDocs untuk fetch data saat filter berubah
} from "firebase/firestore";
// --- Import Library PDF ---
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Deklarasikan tipe tambahan untuk jsPDF-AutoTable
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

// --- Tipe Data Booking (Diperbarui untuk Laporan Detail) ---
interface ReportBooking {
    id: string;
    guestName: string; // <-- Tambah Nama Tamu
    packageName: string; // <-- Tambah Nama Paket
    totalAmount: number;
    paymentStatus: 'pending' | 'paid' | 'cancelled';
    createdAt: Timestamp;
    // Tambahkan field lain jika perlu untuk kalkulasi spesifik
}

// --- Tipe Filter Tanggal ---
type DateFilterType = 'all' | 'month' | 'week' | 'year' | 'custom';

// --- Helper Format Mata Uang ---
const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

// --- Helper Format Tanggal ---
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

// --- Helper Tampilan Status ---
const getStatusBadge = (status: 'pending' | 'paid' | 'cancelled') => {
     switch (status) {
        case 'paid': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Paid</span>;
        case 'cancelled': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Cancelled</span>;
        case 'pending': default: return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
    }
};


// === Halaman Laporan ===
export default function ReportPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // --- State untuk Data Laporan ---
  const [reportData, setReportData] = useState<ReportBooking[]>([]); // Data mentah hasil filter
  const [summaryStats, setSummaryStats] = useState({ // Data ringkasan
      totalRevenue: 0,
      totalPaidBookings: 0,
      averageOrderValue: 0,
      filterDescription: "Semua Waktu" // Deskripsi filter yg aktif
  });

  // --- State untuk Filter Tanggal ---
  const [filterType, setFilterType] = useState<DateFilterType>('all');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');   // YYYY-MM-DD

  const bookingsCollectionRef = collection(db, "bookings");

  // --- Cek Auth ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUID(user.uid);
      } else {
        router.push("/admin");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // --- Fungsi untuk Fetch & Kalkulasi Data Laporan (Dipanggil saat filter berubah) ---
  const loadReportData = useCallback(async () => {
    if (!userUID) return; // Jangan fetch jika belum login

    setIsLoading(true);
    console.log("Memuat data laporan untuk filter:", filterType, startDate, endDate);

    // --- Logika Query dengan Filter ---
    const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
    let startFilterDate: Date | null = null;
    let endFilterDate: Date | null = null;
    let filterDescription = "Semua Waktu";

    const now = new Date();
    // ... (Logika penentuan startFilterDate, endFilterDate, filterDescription - SAMA)
    if (filterType === 'month') {
        startFilterDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endFilterDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        filterDescription = "Bulan Ini";
    } else if (filterType === 'week') {
        const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ...
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
        startFilterDate = new Date(now.getFullYear(), now.getMonth(), diff);
        startFilterDate.setHours(0,0,0,0);
        endFilterDate = new Date(startFilterDate);
        endFilterDate.setDate(startFilterDate.getDate() + 6);
        endFilterDate.setHours(23,59,59,999);
        filterDescription = "Minggu Ini";
    } else if (filterType === 'year') {
        startFilterDate = new Date(now.getFullYear(), 0, 1);
        endFilterDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        filterDescription = "Tahun Ini";
    } else if (filterType === 'custom' && startDate && endDate) {
        try {
            startFilterDate = new Date(startDate);
            endFilterDate = new Date(endDate);
            if (isNaN(startFilterDate.getTime()) || isNaN(endFilterDate.getTime())) throw new Error("Format tanggal custom tidak valid.");
            startFilterDate.setHours(0,0,0,0);
            endFilterDate.setHours(23,59,59,999);
            filterDescription = `${startDate} s/d ${endDate}`;
             if (startFilterDate > endFilterDate) throw new Error("Tanggal mulai tidak boleh setelah tanggal akhir.");
        } catch (dateError: any) {
             console.error("Error parsing custom date:", dateError);
             setToast({ msg: dateError.message || "Tanggal custom tidak valid.", type: "error"});
             setIsLoading(false); return;
        }
    }

    if (startFilterDate && endFilterDate) {
        constraints.push(where("createdAt", ">=", Timestamp.fromDate(startFilterDate)));
        constraints.push(where("createdAt", "<=", Timestamp.fromDate(endFilterDate))); // Gunakan '<=' untuk inklusif
        console.log("Filtering by date:", startFilterDate, endFilterDate);
    } else {
        console.log("No date filter applied.");
    }

    // --- Fetch Data ---
    try {
        const q = query(bookingsCollectionRef, ...constraints);
        const snapshot = await getDocs(q); // Gunakan getDocs, bukan onSnapshot
        console.log(`Ditemukan ${snapshot.docs.length} pesanan sesuai filter.`);

        // --- Ambil data yang relevan ---
        const fetchedBookings = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                guestName: data.guestName || "N/A", // <-- Ambil Nama Tamu
                packageName: data.packageName || "N/A", // <-- Ambil Nama Paket
                totalAmount: data.totalAmount || 0,
                paymentStatus: data.paymentStatus || 'pending',
                createdAt: data.createdAt || Timestamp.now(),
            } as ReportBooking;
        });
        setReportData(fetchedBookings); // Simpan data mentah

        // --- Kalkulasi Statistik ---
        let totalRevenue = 0;
        let totalPaidBookings = 0;
        fetchedBookings.forEach(booking => {
            if (booking.paymentStatus === 'paid') {
                totalRevenue += booking.totalAmount || 0;
                totalPaidBookings++;
            }
        });
        const averageOrderValue = totalPaidBookings > 0 ? totalRevenue / totalPaidBookings : 0;

        // Update state ringkasan
        setSummaryStats({
            totalRevenue,
            totalPaidBookings,
            averageOrderValue,
            filterDescription
        });
        console.log("Summary Stats Calculated:", { totalRevenue, totalPaidBookings, averageOrderValue });

    } catch (error: any) {
        console.error("Gagal fetch data laporan:", error);
         if (error.code === 'failed-precondition') {
             const linkMatch = error.message.match(/https?:\/\/[^\s]+/);
             const indexLink = linkMatch ? linkMatch[0] : null;
             console.error("Firestore index missing. Create index at:", indexLink);
             setToast({ msg: `Index Firestore (createdAt) belum ada. Klik link di console (F12) untuk membuatnya.`, type: "error" });
          } else {
             setToast({ msg: "Gagal memuat data laporan.", type: "error" });
          }
    } finally {
      setIsLoading(false);
      console.log("loadReportData Selesai.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUID, filterType, startDate, endDate]); // Depend on filters

  // --- Panggil loadReportData saat filter berubah ---
  useEffect(() => {
    loadReportData();
  }, [loadReportData]); // loadReportData sudah punya dependency


  // --- Fungsi Export PDF (Sama) ---
   const handleExportPdf = () => { /* ... kode export PDF sama ... */
        console.log("Exporting PDF...");
        const doc = new jsPDF();
        const tableColumn = ["Metrik", "Nilai"];
        const tableRows: string[][] = [
            ["Filter Aktif", summaryStats.filterDescription],
            ["Total Pendapatan (Paid)", formatCurrency(summaryStats.totalRevenue)],
            ["Jumlah Pesanan (Paid)", summaryStats.totalPaidBookings.toString()],
            ["Rata-rata Nilai Pesanan (Paid)", formatCurrency(summaryStats.averageOrderValue)],
            ["Total Semua Pesanan (termasuk pending/cancel)", reportData.length.toString()],
        ];
        doc.setFontSize(18); doc.text("Ringkasan Laporan Pesanan Asoka Trip", 14, 22);
        doc.setFontSize(11); doc.setTextColor(100);
        doc.autoTable({ body: tableRows, startY: 30, theme: 'striped', styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: 'bold' } } });
        const date = new Date(); const dateStr = date.toLocaleDateString('id-ID') + ' ' + date.toLocaleTimeString('id-ID');
        doc.setFontSize(8); doc.text(`Diekspor pada: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.save(`ringkasan_laporan_asoka_${filterType}_${Date.now()}.pdf`);
        console.log("PDF generated."); setToast({ msg: "PDF ringkasan berhasil dibuat!", type: "success" });
    };


  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat laporan..." />}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {/* ... kode header sama ... */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer"><i className="fas fa-arrow-left mr-2"></i>Kembali</span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Laporan Pesanan</h2>
        </div>
        <button onClick={handleExportPdf} disabled={isLoading || reportData.length === 0} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm self-end sm:self-center">
            <i className="fas fa-file-pdf"></i> Ekspor PDF
        </button>
      </div>

       {/* --- Filter Tanggal --- */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow border border-gray-100 flex flex-wrap items-center gap-3 text-sm">
        {/* ... kode filter sama ... */}
        <span className="font-medium mr-2 text-gray-700">Filter Periode:</span>
        <button onClick={() => setFilterType('all')} className={`px-3 py-1 rounded-full ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Semua</button>
        <button onClick={() => setFilterType('month')} className={`px-3 py-1 rounded-full ${filterType === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Bulan Ini</button>
        <button onClick={() => setFilterType('week')} className={`px-3 py-1 rounded-full ${filterType === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Minggu Ini</button>
        <button onClick={() => setFilterType('year')} className={`px-3 py-1 rounded-full ${filterType === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Tahun Ini</button>
        <button onClick={() => setFilterType('custom')} className={`px-3 py-1 rounded-full ${filterType === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Custom</button>
        {filterType === 'custom' && (
            <div className="flex items-center gap-2 ml-auto sm:ml-2 mt-2 sm:mt-0 border-l pl-3">
                 <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500" />
                 <span className="text-gray-500">s/d</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500" />
            </div>
        )}
      </div>

      {/* Konten Utama: Kartu Ringkasan Statistik (Ditambah Efek Hover) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         {/* Tambahkan class transition dan hover */}
         <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
             <p className="text-sm font-medium opacity-80">Total Pendapatan (Paid)</p>
             <p className="text-3xl font-bold mt-1">{isLoading ? '...' : formatCurrency(summaryStats.totalRevenue)}</p>
             <p className="text-xs opacity-70 mt-2">Periode: {summaryStats.filterDescription}</p>
         </div>
         <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
             <p className="text-sm font-medium opacity-80">Jumlah Pesanan (Paid)</p>
             <p className="text-3xl font-bold mt-1">{isLoading ? '...' : summaryStats.totalPaidBookings}</p>
              <p className="text-xs opacity-70 mt-2">Periode: {summaryStats.filterDescription}</p>
         </div>
         <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
             <p className="text-sm font-medium opacity-80">Rata-rata Order (Paid)</p>
             <p className="text-3xl font-bold mt-1">{isLoading ? '...' : formatCurrency(summaryStats.averageOrderValue)}</p>
              <p className="text-xs opacity-70 mt-2">Periode: {summaryStats.filterDescription}</p>
         </div>
      </div>

      {/* (Opsional) Placeholder untuk Grafik */}
      {/*
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Grafik Pendapatan (Coming Soon)</h3>
          <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded">
              Grafik akan ditampilkan di sini...
          </div>
      </div>
      */}

      {/* Tabel Detail Data Mentah (Sudah menampilkan Nama Tamu & Paket) */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mt-8">
         <h3 className="text-lg font-semibold text-gray-800 p-4 border-b border-gray-200">
            Detail Pesanan ({reportData.length}) - Periode: {summaryStats.filterDescription}
         </h3>
          {isLoading ? (
            <p className="text-center py-10 text-gray-500">Memuat detail...</p>
          ) : reportData.length > 0 ? (
             <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-100 text-sm">
                     <thead className="bg-gray-50">
                         <tr>
                             {/* --- KOLOM SUDAH BENAR --- */}
                             <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tgl Pesan</th>
                             <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama Tamu</th>
                             <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama Paket</th>
                             <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                             <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status Bayar</th>
                         </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-100">
                         {reportData.map(b => (
                             <tr key={b.id} className="hover:bg-gray-50">
                                 {/* --- DATA SUDAH BENAR --- */}
                                 <td className="px-4 py-2 whitespace-nowrap text-gray-500">{formatDate(b.createdAt, false)}</td>
                                 <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">{b.guestName}</td>
                                 <td className="px-4 py-2 whitespace-nowrap text-gray-700">{b.packageName}</td>
                                 <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-800">{formatCurrency(b.totalAmount)}</td>
                                 <td className="px-4 py-2 whitespace-nowrap">{getStatusBadge(b.paymentStatus)}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
          ) : (
            <p className="text-center text-gray-500 py-10">Tidak ada data pesanan pada periode ini.</p>
          )}
      </div>
    </>
  );
}

