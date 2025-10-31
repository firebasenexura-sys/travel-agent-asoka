// src/app/(admin)/layout.tsx
import type { Metadata } from "next";
import AdminHeader from "@/components/AdminHeader";

export const metadata: Metadata = {
  title: "Asoka Admin | Dashboard",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 h-[calc(100dvh-4rem)] overflow-y-auto">
        {children}
      </main>
    </>
  );
}
