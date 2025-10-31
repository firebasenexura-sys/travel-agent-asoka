// src/components/admin/AdminHeader.tsx
import TimeWidget from './TimeWidget';
import { FiBell, FiUser } from 'react-icons/fi';

// Catatan: TimeWidget yang digunakan di sini adalah versi yang stylenya disesuaikan untuk header putih
// Pastikan TimeWidget.tsx Anda sudah di-patch dengan style yang sesuai (putih di login, disesuaikan di sini)
const TimeWidgetHeader = () => {
    // Dummy component untuk menggantikan TimeWidget agar stylenya cocok dengan header putih
    return <div className="text-sm text-slate-600 font-medium">Jam: 10:30 WIB</div>
}

export default function AdminHeader() {
    return (
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm sticky top-0 z-10 lg:ml-64">
            {/* Title Area - Akan diganti oleh layout/page spesifik */}
            <h2 className="text-2xl font-bold text-slate-800">
                Dashboard Overview
            </h2>
            
            {/* Right Side Icons / User / Widget */}
            <div className="flex items-center space-x-4">
                
                {/* Notification Icon */}
                <button className="p-2 rounded-full text-slate-500 hover:bg-gray-100 transition relative">
                    <FiBell className="h-6 w-6" />
                    <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                </button>

                {/* User Icon */}
                <button className="p-2 rounded-full text-slate-500 hover:bg-gray-100 transition">
                    <FiUser className="h-6 w-6" />
                </button>

                {/* Time Widget - Tampil di desktop */}
                <div className="hidden md:block">
                    <TimeWidgetHeader />
                </div>
            </div>
        </header>
    );
}