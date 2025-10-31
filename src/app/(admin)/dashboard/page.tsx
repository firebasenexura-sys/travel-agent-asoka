// src/app/(admin)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  Timestamp,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

// ✅ PAKAI SATU SUMBER SAJA — alias path ke config firebase
import { auth, db } from "../../../../lib/firebase/config";

// --- DEFINISI TIPE LITERAL BARU DI SINI (Wajib untuk Build Fix) ---
type TabName = "today" | "tomorrow" | "completed";

// ---- Minimal type agar kompilasi aman ----
// Catatan: Tipe ini harus disinkronkan dengan lib/firebase/types.ts
type PayStatus = "pending" | "paid" | "cancelled" | string;
interface Booking {
  id: string;
  guestName?: string;
  guestPhone?: string;
  tripDate?: string | Timestamp;
  createdAt?: string | Timestamp;
  totalAmount?: number;
  packageName?: string;
  packageId?: string;
  paymentStatus?: PayStatus;
}
// --- (Tipe StatCard dan lainnya diasumsikan ada/didefinisikan di atas komponen) ---


// --- Komponen Kartu Aksi (Menu) ---
function ActionCard({
  href,
  icon,
  title,
  subtitle,
  color = "blue",
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-500",
    green: "text-green-500",
    purple: "text-purple-500",
    red: "text-red-500",
    yellow: "text-yellow-500",
    gray: "text-gray-500",
    indigo: "text-indigo-500",
    pink: "text-pink-500",
    teal: "text-teal-500",
    orange: "text-orange-500",
  };
  const iconColor = colorClasses[color] || colorClasses.purple;

  return (
    <Link href={href} className="block h-full">
      <div className="action-card bg-white p-6 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-center border border-gray-200 h-full flex flex-col justify-center">
        <i className={`fas ${icon} fa-3x ${iconColor} mb-4`} />
        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
    </Link>
  );
}

// --- Komponen Kartu Statistik ---
function StatCard({
  title,
  value,
  icon,
  color = "blue",
}: {
  title: string;
  value: string;
  icon: string;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    red: "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-600",
    gray: "bg-gray-100 text-gray-600",
  };
  const iconBgColor = colorClasses[color] || colorClasses.blue;

  return (
    <div className="stat-card bg-white p-5 rounded-xl shadow-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-gray-800">
            {value}
          </p>
        </div>
        <div
          className={`w-12 h-12 rounded-full ${iconBgColor} flex items-center justify-center flex-shrink-0`}
        >
          <i className={`fas ${icon} fa-lg`} />
        </div>
      </div>
    </div>
  );
}

// --- Tombol Tab Jadwal (KOREKSI TIPE DISINI) ---
function TabButton({
  text,
  activeTab,
  tabName,
  onClick,
}: {
  text: string;
  activeTab: TabName; // <-- KOREKSI: Menerima TabName
  tabName: TabName; // <-- KOREKSI: Menerima TabName
  onClick: (tab: TabName) => void; // <-- KOREKSI: onClick hanya menerima TabName
}) {
  const isActive = activeTab === tabName;
  return (
    <button
      onClick={() => onClick(tabName)}
      className={`w-full py-2 px-4 text-sm font-semibold rounded-md transition-all ${
        isActive ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-200"
      }`}
    >
      {text}
    </button>
  );
}

// --- Helper Format Tanggal (Hanya Tanggal) ---
const formatDateOnly = (dateInput: string | Timestamp | undefined) => {
  if (!dateInput) return "N/A";
  try {
    if (typeof (dateInput as Timestamp)?.toDate === "function") {
      return (dateInput as Timestamp)
        .toDate()
        .toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
    }
    if (typeof dateInput === "string") {
      const d = new Date(dateInput);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
    }
    return "N/A";
  } catch {
    return "N/A";
  }
};

// --- Kartu Pesanan ---
function BookingCard({ booking }: { booking: Booking }) {
  const guestPhone =
    booking.guestPhone || '<i class="text-gray-400">N/A</i>';
  const bookingDate = booking.tripDate
    ? formatDateOnly(booking.tripDate)
    : "N/A";
  const totalAmountFormatted = booking.totalAmount
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(booking.totalAmount)
    : "N/A";

  return (
    <div className="border border-gray-200 bg-gray-50/50 rounded-lg p-4 transition hover:shadow-md">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-2 mb-2">
        <div>
          <p className="font-bold text-gray-800">
            {booking.guestName || "—"}
          </p>
          <p className="text-sm text-gray-500">
            <i className="fas fa-phone-alt fa-fw mr-1" />
            <span
              dangerouslySetInnerHTML={{ __html: guestPhone }}
            />
          </p>
        </div>
        <p className="font-semibold text-blue-600 text-lg mt-2 sm:mt-0">
          {totalAmountFormatted}
        </p>
      </div>
      <div className="text-sm text-gray-600">
        <p className="mb-1">
          <strong>
            <i className="fas fa-box-archive fa-fw mr-1" />
            Paket:
          </strong>{" "}
          {booking.packageName}{" "}
          {booking.packageId === "custom" && (
            <span className="text-xs text-blue-600">(Custom)</span>
          )}
        </p>
        <p className="mb-2">
          <strong>
            <i className="fas fa-calendar-alt fa-fw mr-1" />
            Tanggal Trip:
          </strong>{" "}
          {bookingDate}
        </p>
      </div>
    </div>
  );
}

// --- KOMPONEN UTAMA DASHBOARD ---
export default function DashboardPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("Memuat...");
  const [realTimeDate, setRealTimeDate] = useState("Memuat tanggal...");
  const [realTimeClock, setRealTimeClock] = useState("--:--:--");

  const [stats, setStats] = useState({
    totalPackages: "-",
    totalBookings: "-",
    pendingBookings: "-",
  });
  const [activeTab, setActiveTab] = useState<TabName>("today"); // <-- KOREKSI: Menggunakan TabName
  const [scheduleData, setScheduleData] = useState<{
    today: Booking[];
    tomorrow: Booking[];
    completed: Booking[];
  }>({ today: [], tomorrow: [], completed: [] });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // --- Auth & Jam Realtime ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email || "Email tidak ditemukan");
        loadDashboardData();
      } else {
        router.push("/login");
      }
    });

    const clockInterval = setInterval(() => {
      const now = new Date();
      setRealTimeDate(
        now.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
      setRealTimeClock(
        now.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    }, 1000);

    return () => {
      unsubscribeAuth();
      clearInterval(clockInterval);
    };
  }, [router]);

  // --- Muat Statistik, Jadwal, Pesanan Terakhir ---
  const loadDashboardData = async () => {
    setIsLoadingData(true);
    try {
      const packagesQuery = query(collection(db, "packages"));
      const packagesSnap = await getDocs(packagesQuery);
      const totalPackages = packagesSnap.size.toString();

      const bookingsQuery = query(
        collection(db, "bookings"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const bookingsSnap = await getDocs(bookingsQuery);

      let pendingCount = 0;
      const arrToday: Booking[] = [],
        arrTomorrow: Booking[] = [],
        arrCompleted: Booking[] = [];
      const recentBookingsData: Booking[] = [];
      const totalBookings = bookingsSnap.size.toString();

      const now = new Date();
      const todayStr = now
        .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
        .replace(/\//g, "-");
      const tomorrowDate = new Date(now);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = tomorrowDate
        .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
        .replace(/\//g, "-");

      bookingsSnap.docs.forEach((docSnap, index) => {
        const booking = { id: docSnap.id, ...docSnap.data() } as Booking;

        const tripDateStr = booking.tripDate as string | undefined;
        if (tripDateStr) {
          if (tripDateStr === todayStr) {
            arrToday.push(booking);
          } else if (tripDateStr === tomorrowStr) {
            arrTomorrow.push(booking);
          } else if (tripDateStr < todayStr) {
            arrCompleted.push(booking);
          }
        }

        if (index < 5) recentBookingsData.push(booking);
        if (booking.paymentStatus === "pending") pendingCount++;
      });

      setStats({
        totalPackages,
        totalBookings,
        pendingBookings: pendingCount.toString(),
      });
      setScheduleData({
        today: arrToday,
        tomorrow: arrTomorrow,
        completed: arrCompleted,
      });
      setRecentBookings(recentBookingsData);
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // === RENDER HALAMAN ===
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="bg-white p-6 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Selamat datang, <span className="text-blue-600">Admin</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            <i className="fas fa-envelope fa-fw mr-1" />
            {userEmail}
          </p>
        </div>
        <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
          <p className="text-xl font-semibold text-gray-700" id="realTimeDate">
            {realTimeDate}
          </p>
          <p className="text-sm text-gray-500" id="realTimeClock">
            {realTimeClock}
          </p>
        </div>
      </section>

      {/* Statistik */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Paket Trip"
          value={isLoadingData ? "—" : stats.totalPackages}
          icon="fa-box-archive"
          color="blue"
        />
        <StatCard
          title="Total Pesanan"
          value={isLoadingData ? "—" : stats.totalBookings}
          icon="fa-clipboard-list"
          color="green"
        />
        <StatCard
          title="Pesanan Pending"
          value={isLoadingData ? "—" : stats.pendingBookings}
          icon="fa-hourglass-half"
          color="yellow"
        />
      </section>

      {/* Menu Admin (Action Cards) */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-gray-700 mb-4">Menu Utama</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            href="/dashboard/cms"
            icon="fa-pen-to-square"
            title="Hpanel (CMS)"
            subtitle="Edit konten landing page."
            color="purple"
          />
          <ActionCard
            href="/dashboard/packages"
            icon="fa-box-archive"
            title="Kelola Paket Trip"
            subtitle="Atur semua paket trip publik."
            color="blue"
          />
          <ActionCard
            href="/dashboard/bookings"
            icon="fa-clipboard-list"
            title="Kelola Pesanan"
            subtitle="Lihat & kelola semua pesanan."
            color="green"
          />
          <ActionCard
            href="/dashboard/input-booking"
            icon="fa-cart-plus"
            title="Input Pesanan Manual"
            subtitle="Tambah pesanan offline."
            color="yellow"
          />
          <ActionCard
            href="/dashboard/report"
            icon="fa-chart-line"
            title="Laporan"
            subtitle="Lihat data pendapatan & statistik."
            color="red"
          />
          <ActionCard
            href="/dashboard/settings"
            icon="fa-user-cog"
            title="Setting Akun"
            subtitle="Ganti password & profil admin."
            color="gray"
          />
        </div>
      </section>

      {/* Jadwal Pesanan */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-gray-700 mb-4">
          Jadwal Pesanan
        </h2>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="bg-gray-100 p-1.5 rounded-lg flex space-x-2 mb-4 overflow-x-auto">
            <TabButton
              text="Hari Ini"
              activeTab={activeTab}
              tabName="today"
              onClick={setActiveTab}
            />
            <TabButton
              text="Besok"
              activeTab={activeTab}
              tabName="tomorrow"
              onClick={setActiveTab}
            />
            <TabButton
              text="Selesai (Lampau)"
              activeTab={activeTab}
              tabName="completed"
              onClick={setActiveTab}
            />
          </div>

          <div className="space-y-4">
            {isLoadingData ? (
              <p className="text-center py-4 text-gray-500">
                <i className="fas fa-spinner fa-spin mr-2" />
                Memuat jadwal...
              </p>
            ) : (
              <>
                <div
                  id="today"
                  className={`space-y-3 ${
                    activeTab === "today" ? "block" : "hidden"
                  }`}
                >
                  {scheduleData.today.length > 0 ? (
                    scheduleData.today.map((b) => (
                      <BookingCard key={b.id} booking={b} />
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      Tidak ada pesanan untuk hari ini.
                    </p>
                  )}
                </div>

                <div
                  id="tomorrow"
                  className={`space-y-3 ${
                    activeTab === "tomorrow" ? "block" : "hidden"
                  }`}
                >
                  {scheduleData.tomorrow.length > 0 ? (
                    scheduleData.tomorrow.map((b) => (
                      <BookingCard key={b.id} booking={b} />
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      Tidak ada pesanan untuk besok.
                    </p>
                  )}
                </div>

                <div
                  id="completed"
                  className={`space-y-3 ${
                    activeTab === "completed" ? "block" : "hidden"
                  }`}
                >
                  {scheduleData.completed.length > 0 ? (
                    scheduleData.completed.map((b) => (
                      <BookingCard key={b.id} booking={b} />
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      Tidak ada riwayat pesanan selesai.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 5 Pesanan Terakhir */}
      <section>
        <h2 className="text-2xl font-bold text-gray-700 mb-4">
          5 Pesanan Masuk Terakhir
        </h2>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tgl Pesan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tamu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tgl Trip
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody id="recentBookings" className="bg-white divide-y divide-gray-200">
              {isLoadingData ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    <i className="fas fa-spinner fa-spin mr-2" />
                    Memuat data...
                  </td>
                </tr>
              ) : recentBookings.length > 0 ? (
                recentBookings.map((b) => {
                  const createdAt = formatDateOnly(b.createdAt);
                  const tripDate = formatDateOnly(b.tripDate);
                  const total = b.totalAmount
                    ? new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(b.totalAmount)
                    : "N/A";
                  let statusBadge = (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {b.paymentStatus || "N/A"}
                    </span>
                  );
                  if (b.paymentStatus === "paid") {
                    statusBadge = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Paid
                      </span>
                    );
                  } else if (b.paymentStatus === "cancelled") {
                    statusBadge = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Cancelled
                      </span>
                    );
                  } else if (b.paymentStatus === "pending") {
                    statusBadge = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    );
                  }

                  return (
                    <tr key={b.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {createdAt}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {b.guestName || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {b.guestPhone || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tripDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{statusBadge}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    Belum ada pesanan terbaru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}