'use client';

import Link from "next/link";

export default function CmsActionCard({
  href, icon, title, subtitle, color = "purple",
}: {
  href: string;
  icon: string;    // Font Awesome class tanpa 'fas'
  title: string;
  subtitle: string;
  color?: "blue"|"green"|"purple"|"red"|"yellow"|"gray"|"indigo"|"pink"|"teal"|"orange";
}) {
  const colors: Record<string, string> = {
    blue:"text-blue-500", green:"text-green-500", purple:"text-purple-500",
    red:"text-red-500", yellow:"text-yellow-500", gray:"text-gray-500",
    indigo:"text-indigo-500", pink:"text-pink-500", teal:"text-teal-500", orange:"text-orange-500",
  };
  const iconColor = colors[color] ?? colors.purple;

  return (
    <Link href={href} className="block h-full">
      <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all
                      text-center border border-gray-200 h-full flex flex-col justify-center">
        <i className={`fas ${icon} fa-3x ${iconColor} mb-4`} />
        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
    </Link>
  );
}
