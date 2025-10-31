// Ini adalah file BARU: app/admin/dashboard/settings/page.tsx
// Halaman untuk mengubah password admin dan profil
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
import {
  User, // <-- Import User type
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile // <-- Import untuk update profil
} from "firebase/auth";

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


// === Halaman Setting Akun ===
export default function AccountSettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Simpan object user
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false); // Loading untuk profil
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // === State untuk Form Ganti Password ===
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // === State BARU untuk Form Edit Profil ===
  const [displayName, setDisplayName] = useState("");

  // --- Cek Auth & Ambil Info Awal ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user); // Simpan seluruh objek user
        setDisplayName(user.displayName || ""); // Ambil display name
      } else {
        router.push("/admin"); // Tendang jika tidak login
      }
    });
    return () => unsubscribe(); // Cleanup listener
  }, [router]);

  // --- Fungsi Ganti Password ---
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    // ... (Validasi input sama)
    if (!currentPassword || !newPassword || !confirmPassword) { setToast({ msg: "Semua field password wajib diisi.", type: "error" }); return; }
    if (newPassword.length < 6) { setToast({ msg: "Password baru minimal 6 karakter.", type: "error" }); return; }
    if (newPassword !== confirmPassword) { setToast({ msg: "Password baru dan konfirmasi tidak cocok.", type: "error" }); return; }


    if (!currentUser || !currentUser.email) {
      setToast({ msg: "Error: Tidak dapat menemukan user yang login.", type: "error" });
      return;
    }

    setIsLoading(true);

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      console.log("Mencoba re-autentikasi...");
      await reauthenticateWithCredential(currentUser, credential);
      console.log("Re-autentikasi berhasil.");

      console.log("Mencoba update password...");
      await updatePassword(currentUser, newPassword);
      console.log("Update password berhasil.");

      setToast({ msg: "Password berhasil diperbarui!", type: "success" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");

    } catch (error: any) { /* ... (Error handling sama) ... */
      console.error("Gagal ganti password:", error);
      if (error.code === 'auth/wrong-password') { setToast({ msg: "Password lama yang Anda masukkan salah.", type: "error" });
      } else if (error.code === 'auth/too-many-requests') { setToast({ msg: "Terlalu banyak percobaan gagal. Coba lagi nanti.", type: "error" });
      } else { setToast({ msg: `Gagal ganti password: ${error.message || error.code}`, type: "error" }); }
    } finally {
      setIsLoading(false);
    }
  };

   // --- Fungsi BARU: Update Profil ---
   const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setToast(null);

      if (!currentUser) {
          setToast({ msg: "Error: User tidak ditemukan.", type: "error" });
          return;
      }
      // Validasi nama jika perlu
      if (!displayName.trim()) {
           setToast({ msg: "Nama Tampilan tidak boleh kosong.", type: "error" });
           return;
      }

      setIsProfileLoading(true);

      try {
          console.log("Mencoba update profil...");
          await updateProfile(currentUser, {
              displayName: displayName.trim(),
              // photoURL: 'URL_FOTO_JIKA_ADA' // Bisa ditambahkan nanti
          });
          console.log("Update profil berhasil.");
          setToast({ msg: "Profil berhasil diperbarui!", type: "success" });
          // Update state user (opsional, karena onAuthStateChanged mungkin update)
          // setCurrentUser({ ...currentUser, displayName: displayName.trim() });

      } catch (error: any) {
           console.error("Gagal update profil:", error);
           setToast({ msg: `Gagal update profil: ${error.message || error.code}`, type: "error" });
      } finally {
           setIsProfileLoading(false);
      }
  };


  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {(isLoading || isProfileLoading) && <Loader text={isLoading ? "Memproses password..." : "Menyimpan profil..."} />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
         {/* ... (kode header sama) ... */}
         <div className="flex items-center gap-4"> <Link href="/dashboard"> <span className="text-gray-500 hover:text-blue-600 cursor-pointer"> <i className="fas fa-arrow-left mr-2"></i>Kembali </span> </Link> <h2 className="text-2xl font-bold text-gray-800">Setting Akun</h2> </div>
      </div>

      {/* Grid Layout untuk Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* --- Kolom Kiri: Ubah Password --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            <i className="fas fa-key mr-2 text-gray-500"></i> Ubah Password Login
          </h3>
          {currentUser?.email && (
              <p className="text-sm text-gray-600 mb-4">
                  Anda login sebagai: <strong>{currentUser.email}</strong>
              </p>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Input Password Saat Ini */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
              <input id="currentPassword" name="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            {/* Input Password Baru */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">Password Baru (Min. 6 karakter)</label>
              <input id="newPassword" name="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            {/* Input Konfirmasi Password Baru */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
              <input id="confirmPassword" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            {/* Tombol Simpan Password */}
            <div className="flex justify-end pt-4">
              <button type="submit" disabled={isLoading} className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                Simpan Password Baru
              </button>
            </div>
          </form>
        </div>

        {/* --- Kolom Kanan: Edit Profil --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            <i className="fas fa-user-edit mr-2 text-green-500"></i> Edit Profil Admin
          </h3>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
             {/* Input Nama Tampilan */}
             <div>
               <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">Nama Tampilan</label>
               <input
                 id="displayName"
                 name="displayName"
                 type="text"
                 value={displayName}
                 onChange={(e) => setDisplayName(e.target.value)}
                 required
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                 placeholder="Nama yang akan ditampilkan"
               />
             </div>

             {/* (Opsional) Input Foto Profil bisa ditambahkan di sini */}
             {/*
             <div>
                <label htmlFor="photoFile" className="block text-sm font-medium text-gray-700 mb-1">Foto Profil (Opsional)</label>
                <input id="photoFile" name="photoFile" type="file" accept="image/*" className="..." />
             </div>
             */}

             {/* Tombol Simpan Profil */}
             <div className="flex justify-end pt-4">
               <button
                 type="submit"
                 disabled={isProfileLoading}
                 className="bg-green-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {isProfileLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                 Simpan Profil
               </button>
             </div>
          </form>
        </div>

      </div>
    </>
  );
}

