// src/components/admin/Sidebar.tsx
'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiHome, FiPackage, FiLogOut, FiDollarSign, FiUsers } from 'react-icons/fi';
import { adminSignOut } from '../../../lib/firebase/auth'; // <-- Pastikan path ini benar
import toast from 'react-hot-toast';

const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: FiHome },
    { name: 'Trip Packages', href: '/dashboard/trips', icon: FiPackage },
    { name: 'Bookings', href: '/dashboard/bookings', icon: FiDollarSign },
    { name: 'Users', href: '/dashboard/users', icon: FiUsers },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await adminSignOut();
        toast.success("Anda telah Logout.");
        router.push('/login');
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white w-64 fixed top-0 left-0 bottom-0 shadow-2xl z-20">
            {/* Header / Logo */}
            <div className="p-6 text-center border-b border-slate-700/50">
                <h1 className="text-3xl font-extrabold tracking-tight text-yellow-400">
                    ASOKA ADMIN
                </h1>
                <p className="text-sm text-slate-400 mt-1">Management Panel</p>
            </div>

            {/* Navigation */}
            <nav className="flex-grow p-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link 
                            key={item.name} 
                            href={item.href}
                            className={`flex items-center space-x-3 p-3 rounded-xl transition duration-200 
                                ${isActive 
                                    ? 'bg-yellow-500 text-slate-900 font-bold shadow-md transform scale-[1.02]' 
                                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                }`}
                        >
                            <item.icon className="h-5 w-5" />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-slate-700/50">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-3 p-3 rounded-xl transition duration-200 bg-red-600 text-white font-semibold hover:bg-red-700"
                >
                    <FiLogOut className="h-5 w-5" />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
}