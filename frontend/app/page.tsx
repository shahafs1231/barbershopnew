"use client";
import Link from "next/link";
import { Scissors, Clock, Calendar, CreditCard, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const icons = [
  <Scissors className="w-6 h-6" key="s" />,
  <Calendar className="w-6 h-6" key="c" />,
  <Clock className="w-6 h-6" key="cl" />,
  <CreditCard className="w-6 h-6" key="cr" />,
];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col">

      {/* Hero — uses hero-bg.png if uploaded, falls back to dark bg */}
      <section
        className="relative min-h-screen flex flex-col bg-[#1a1a1a] bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-bg.png')" }}
      >
        {/* Dark overlay so text stays readable over any photo */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Header */}
        <header className="relative z-10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-amber-400" />
            <span className="text-xl font-bold tracking-tight text-white">{t.nav.brand}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link href="/admin" className="text-sm text-gray-300 hover:text-white transition-colors">
              {t.nav.adminPanel}
            </Link>
          </div>
        </header>

        {/* Hero text */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
          <h1 className="text-5xl font-black tracking-tight text-white mb-4 drop-shadow-lg">
            {t.home.tagline1}<br />
            <span className="text-amber-400">{t.home.tagline2}</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-md mx-auto mb-10">
            {t.home.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-amber-400 text-[#1a1a1a] font-bold px-8 py-4 rounded-full text-lg hover:bg-amber-300 transition-colors shadow-lg"
            >
              {t.nav.bookNow} <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/manage"
              className="inline-flex items-center gap-2 border border-white/40 text-white px-8 py-4 rounded-full text-base font-medium hover:bg-white/10 transition-colors"
            >
              {t.nav.manageAppt}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {t.home.features.map((f, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3"
          >
            <span className="bg-amber-50 text-amber-600 w-12 h-12 flex items-center justify-center rounded-xl">
              {icons[i]}
            </span>
            <h3 className="font-bold text-gray-900">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Bottom CTA */}
      <section
        className="relative py-20 px-6 text-center bg-[#1a1a1a] bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-bg.png')" }}
      >
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10">
          <h2 className="text-white text-3xl font-bold mb-6">{t.home.readyTitle}</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-amber-400 text-[#1a1a1a] font-bold px-8 py-3 rounded-full hover:bg-amber-300 transition-colors"
            >
              {t.home.scheduleNow} <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/manage"
              className="inline-flex items-center gap-2 border border-white/30 text-white px-8 py-3 rounded-full hover:bg-white/10 transition-colors text-sm font-medium"
            >
              {t.nav.manageAppt}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
