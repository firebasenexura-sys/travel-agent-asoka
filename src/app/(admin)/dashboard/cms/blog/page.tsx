// Ini adalah file BARU: app/admin/dashboard/cms/blog/page.tsx
// Halaman untuk mengelola artikel blog
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
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

// --- Tipe Data untuk Artikel Blog ---
interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string; // Konten artikel (nanti bisa pakai rich text editor)
  imageUrl: string; // Gambar utama
  status: 'published' | 'draft'; // Status publish
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}


// === Halaman Kelola Blog ===
export default function ManageBlogPage() {
  const router = useRouter();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading data awal
  const [isSaving, setIsSaving] = useState(false); // Loading saat simpan/hapus
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === State untuk Data Artikel ===
  const [posts, setPosts] = useState<BlogPost[]>([]);

  // === State untuk Modal Form ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postStatus, setPostStatus] = useState<'published' | 'draft'>("draft");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null); // URL lama saat edit

  // Referensi ke koleksi Firestore
  const blogCollectionRef = collection(db, "blogPosts"); // Nama koleksi: blogPosts

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
      if (posts.length === 0 && !isModalOpen) {
          setIsLoading(true);
      }
      // Urutkan berdasarkan createdAt descending (terbaru dulu)
      const q = query(blogCollectionRef, orderBy("createdAt", "desc"));
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
        setPosts(postsData);
        setIsLoading(false); // Stop loading setelah data diterima
      }, (error) => {
        console.error("Gagal mengambil data blog:", error);
        setToast({ msg: "Gagal memuat artikel blog.", type: "error" });
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


  // --- Fungsi Slug ---
  const createSlug = (text: string): string => { // Tambahkan tipe return string
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };


  // --- Fungsi Buka/Tutup Modal ---
  const resetForm = () => {
    setCurrentEditingId(null);
    setPostTitle("");
    setPostSlug("");
    setPostContent("");
    setPostStatus("draft");
    setPostImageFile(null);
    setPostImagePreview(null);
    setCurrentImageUrl(null);
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (post: BlogPost) => {
    resetForm();
    setCurrentEditingId(post.id);
    setPostTitle(post.title);
    setPostSlug(post.slug);
    setPostContent(post.content);
    setPostStatus(post.status || 'draft');
    setPostImagePreview(post.imageUrl); // Tampilkan gambar lama
    setCurrentImageUrl(post.imageUrl);   // Simpan URL lama
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    resetForm();
    setIsModalOpen(false);
  };

  // --- Fungsi Handle Upload Gambar ---
   const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Limit 2MB
        setToast({ msg: "Ukuran gambar maksimal 2 MB.", type: "error" });
        return;
      }
      setPostImageFile(file); // Simpan File object
      setPostImagePreview(URL.createObjectURL(file)); // Buat & simpan Object URL preview
    }
  };


  // --- Fungsi Simpan (Create/Update) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUID || !postTitle || !postContent) {
       setToast({ msg: "Judul dan Konten Artikel wajib diisi.", type: "error" });
       return;
    }
    // Wajibkan gambar saat tambah baru
    if (!currentEditingId && !postImageFile) {
        setToast({ msg: "Gambar utama wajib diupload.", type: "error" });
        return;
    }

    setIsSaving(true);
    setToast(null);

    try {
      let finalImageUrl = currentImageUrl || ""; // Default pakai URL lama

      // 1. Upload Gambar Baru (jika ada file dipilih)
      if (postImageFile) {
        // Hapus gambar lama di storage JIKA ada gambar lama DAN ada file baru
        if (currentImageUrl) {
           try {
             const oldImageRef = ref(storage, currentImageUrl);
             await deleteObject(oldImageRef);
           } catch (deleteError: any) {
             if (deleteError.code !== 'storage/object-not-found') {
               console.warn("Gagal hapus gambar lama, tapi lanjut:", deleteError);
             }
           }
        }
        // Upload gambar baru
        const fileName = `${userUID}_blog_${Date.now()}_${postImageFile.name}`;
        const storageRef = ref(storage, `blogImages/${fileName}`); // Simpan di folder 'blogImages'
        console.log(`Uploading ke: blogImages/${fileName}`);
        const uploadTask = await uploadBytes(storageRef, postImageFile);
        finalImageUrl = await getDownloadURL(uploadTask.ref);
        console.log("Upload gambar blog berhasil:", finalImageUrl);
      } else if (!currentEditingId && !finalImageUrl) {
         throw new Error("Gambar utama wajib ada untuk artikel baru.");
      }


      // 2. Siapkan Data
      const dataToSave = {
        title: postTitle,
        slug: postSlug || createSlug(postTitle), // Buat slug jika kosong
        content: postContent,
        imageUrl: finalImageUrl, // Simpan URL (baru atau lama)
        status: postStatus,
        updatedAt: serverTimestamp(),
      };

      // 3. Update atau Create
      if (currentEditingId) {
        // Update
        const docRef = doc(db, "blogPosts", currentEditingId);
        await updateDoc(docRef, dataToSave);
        console.log("Artikel diupdate:", currentEditingId);
      } else {
        // Create
        const docRef = await addDoc(blogCollectionRef, {
          ...dataToSave,
          createdAt: serverTimestamp(), // Tambah createdAt saat baru
          authorId: userUID, // Simpan ID penulis
        });
        console.log("Artikel baru ditambahkan:", docRef.id);
      }

      setToast({ msg: "Artikel berhasil disimpan!", type: "success" });
      closeModal();

    } catch (error: any) {
      console.error("Gagal menyimpan artikel:", error);
      setToast({ msg: `Gagal menyimpan: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Fungsi Hapus ---
  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Yakin ingin menghapus artikel "${post.title}"?`)) return;
    setIsSaving(true);
    setToast(null);
    try {
      // 1. Hapus dokumen Firestore
      await deleteDoc(doc(db, "blogPosts", post.id));
      console.log("Dokumen blog dihapus:", post.id);

      // 2. Hapus gambar di Storage (jika ada URL)
      if (post.imageUrl) {
        try {
          const imageRef = ref(storage, post.imageUrl);
          await deleteObject(imageRef);
          console.log("Gambar blog dihapus:", post.imageUrl);
        } catch (deleteError: any) {
          if (deleteError.code !== 'storage/object-not-found') {
            console.warn("Gagal hapus gambar, tapi dokumen terhapus:", deleteError);
          } else {
              console.log("Gambar sudah tidak ada di storage:", post.imageUrl);
          }
        }
      }
      setToast({ msg: "Artikel berhasil dihapus.", type: "success" });
    } catch (error: any) {
      console.error("Gagal menghapus artikel:", error);
      setToast({ msg: `Gagal menghapus: ${error.message || error.code}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Halaman ---
  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {isLoading && <Loader text="Memuat artikel..." />}
      {isSaving && <Loader text="Menyimpan/Menghapus..." />}

      {/* Header Halaman */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cms">
            <span className="text-gray-500 hover:text-blue-600 cursor-pointer">
              <i className="fas fa-arrow-left mr-2"></i>Kembali ke Hpanel
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Kelola Artikel/Blog</h2>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Tulis Artikel Baru
        </button>
      </div>

      {/* Konten Utama: Daftar Artikel (Contoh: Tabel) */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
         <h3 className="text-xl font-semibold text-gray-800 p-6 border-b border-gray-200">
           <i className="fas fa-newspaper mr-2 text-orange-500"></i> Daftar Artikel
         </h3>
         {isLoading ? (
            <p className="text-center py-10 text-gray-500">Memuat...</p>
         ) : posts.length > 0 ? (
             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {posts.map(post => (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-md object-cover bg-gray-200" src={post.imageUrl || "https://placehold.co/100x100/e2e8f0/94a3b8?text=N/A"} alt="" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{post.title}</div>
                            <div className="text-sm text-gray-500">/{post.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {post.status === 'published' ? (
                           <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Published</span>
                        ) : (
                           <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Draft</span>
                        )}
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                         <button onClick={() => handleEdit(post)} className="text-indigo-600 hover:text-indigo-900" title="Edit">
                           <i className="fas fa-edit"></i>
                         </button>
                         <button onClick={() => handleDelete(post)} className="text-red-600 hover:text-red-900" title="Hapus">
                          <i className="fas fa-trash"></i>
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
         ) : (
           <p className="text-center text-gray-500 py-10">
             Belum ada artikel. Klik "Tulis Artikel Baru" untuk memulai.
           </p>
         )}
      </div>


      {/* === MODAL FORM TAMBAH/EDIT === */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div onClick={closeModal} className="absolute inset-0"></div>
          {/* Modal Card */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {currentEditingId ? "Edit Artikel" : "Tulis Artikel Baru"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times fa-lg"></i>
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <form id="blogForm" onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-5">

              {/* Judul Artikel */}
              <div>
                <label htmlFor="postTitle" className="block text-sm font-medium text-gray-700 mb-1">Judul Artikel</label>
                <input id="postTitle" type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
              </div>

               {/* Slug (URL) */}
              <div>
                <label htmlFor="postSlug" className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input id="postSlug" type="text" value={postSlug} onChange={(e) => setPostSlug(createSlug(e.target.value))} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50" placeholder="Kosongkan untuk auto-generate" />
                <p className="text-xs text-gray-500 mt-1">Hanya huruf kecil, angka, dan tanda hubung (-).</p>
              </div>

              {/* Konten Artikel */}
              <div>
                <label htmlFor="postContent" className="block text-sm font-medium text-gray-700 mb-1">Konten Artikel</label>
                {/* Ganti textarea ini dengan Rich Text Editor jika perlu */}
                <textarea id="postContent" value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={15} required className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Tulis isi artikel Anda di sini..."></textarea>
              </div>

               {/* Gambar Utama */}
              <div className="space-y-2">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Gambar Utama (Maks 2MB)</label>
                 {postImagePreview ? (
                   <img src={postImagePreview} alt="Preview" className="w-full max-w-sm h-auto aspect-video object-cover border border-gray-200 rounded-lg bg-gray-50 mb-2" />
                 ) : (
                   <div className="w-full max-w-sm aspect-video flex items-center justify-center border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 mb-2">Image Preview</div>
                 )}
                 <input
                   id="postImageFile"
                   type="file"
                   accept="image/png, image/jpeg, image/webp"
                   onChange={handleImageChange}
                   className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                 />
              </div>

              {/* Status Publish */}
              <div>
                <label htmlFor="postStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="postStatus" value={postStatus} onChange={(e) => setPostStatus(e.target.value as 'published' | 'draft')} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white">
                    <option value="draft">Draft (Simpan)</option>
                    <option value="published">Published (Terbitkan)</option>
                </select>
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
                form="blogForm" // Hubungkan ke ID form
                disabled={isSaving}
                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {currentEditingId ? "Update Artikel" : "Simpan Artikel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
