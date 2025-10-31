"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@lib/firebase/config";       // pakai alias agar simple
import CmsActionCard from "./CmsActionCard";

export default function CmsHubPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsub();
  }, [router]);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Hpanel (CMS Landing Page)</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <CmsActionCard href="/dashboard/cms/landing-page" icon="fa-pager"
          title="Edit Landing Page" subtitle="Hero, Sosmed, Kontak, About." color="indigo" />
        <CmsActionCard href="/dashboard/cms/gallery" icon="fa-images"
          title="Edit Galeri Foto" subtitle="Kelola foto-foto di galeri." color="pink" />
        <CmsActionCard href="/dashboard/cms/destinations" icon="fa-map-location-dot"
          title="Destinasi Unggulan" subtitle="Kelola info destinasi." color="green" />
        <CmsActionCard href="/dashboard/cms/why-us" icon="fa-heart"
          title="Edit 'Kenapa Asoka?'" subtitle="Ubah poin-poin keunggulan." color="yellow" />
        <CmsActionCard href="/dashboard/cms/testimonials" icon="fa-comments"
          title="Kelola Testimoni" subtitle="Tambah/ubah review pelanggan." color="teal" />
        <CmsActionCard href="/dashboard/cms/blog" icon="fa-newspaper"
          title="Kelola Artikel/Blog" subtitle="Tulis & publikasikan artikel." color="orange" />
        <CmsActionCard href="/dashboard/cms/faq" icon="fa-question-circle"
          title="Kelola FAQ" subtitle="Tambah/ubah pertanyaan umum." color="blue" />
        <CmsActionCard href="/dashboard/cms/footer" icon="fa-shoe-prints"
          title="Edit Footer" subtitle="Ubah teks & link di footer." color="gray" />
      </div>
    </section>
  );
}
