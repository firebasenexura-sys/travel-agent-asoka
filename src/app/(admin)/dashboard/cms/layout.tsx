import Link from "next/link";

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Link href="/dashboard" className="hover:text-blue-600">
            <i className="fa-solid fa-gauge-high mr-2" />Dashboard
          </Link>
          <span>›</span>
          <span className="font-medium">Hpanel (CMS)</span>
        </div>
      </div>
      {children}
    </div>
  );
}
