"use client";
import { createContext, useContext, useState, useEffect } from "react";
import translations, { type Lang, type Translations } from "./translations";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  t: translations.en as Translations,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Hydrate from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "he" || saved === "en") setLangState(saved);
  }, []);

  // Apply dir + lang attribute on <html>
  useEffect(() => {
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    localStorage.setItem("lang", lang);
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] as Translations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
