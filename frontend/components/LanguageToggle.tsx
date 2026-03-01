"use client";
import { useLanguage } from "@/lib/LanguageContext";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "he" : "en")}
      className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/20 text-sm font-bold hover:bg-white/10 transition-colors"
      title={lang === "en" ? "Switch to Hebrew" : "עבור לאנגלית"}
    >
      {lang === "en" ? (
        <span className="tracking-wide">עב</span>
      ) : (
        <span className="tracking-wide">EN</span>
      )}
    </button>
  );
}
