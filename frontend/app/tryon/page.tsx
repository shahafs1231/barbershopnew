"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { Scissors, Sparkles, Upload, ChevronRight, ArrowLeft, Info } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export default function TryOnPage() {
  const { t } = useLanguage();
  const tr = t.tryon;
  const fileRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customStyle, setCustomStyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; mime_type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  function getStyle(): string {
    if (customStyle.trim()) return customStyle.trim();
    if (selectedPreset !== null) return tr.presets[selectedPreset].desc;
    return "";
  }

  async function generate() {
    if (!photo) return;
    const style = getStyle();
    if (!style) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("photo", photo);
      fd.append("style", style);

      const res = await fetch(`${API_URL}/ai/hairstyle-preview`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = !!photo && (selectedPreset !== null || customStyle.trim() !== "") && !loading;

  return (
    <div className="min-h-screen bg-[#111] text-white" dir={t.dir}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-white">{t.nav.brand}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t.nav.backToSite}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 text-amber-300 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" /> AI Powered
          </div>
          <h1 className="text-4xl font-black mb-3">{tr.pageTitle}</h1>
          <p className="text-gray-400 max-w-lg mx-auto">{tr.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT — Upload + Style picker */}
          <div className="flex flex-col gap-6">
            {/* Photo upload */}
            <div>
              <p className="text-sm font-medium text-gray-300 mb-3">{tr.uploadLabel}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden aspect-square border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover" />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white text-xs px-3 py-1.5 rounded-full border border-white/20 transition-colors"
                  >
                    {tr.changePhoto}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full aspect-square rounded-2xl border-2 border-dashed border-white/20 hover:border-amber-400/50 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-amber-300 transition-colors"
                >
                  <Upload className="w-10 h-10" />
                  <span className="text-sm font-medium">{tr.uploadBtn}</span>
                </button>
              )}
            </div>

            {/* Tips */}
            <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-2 text-sm text-gray-400">
              <div className="flex items-center gap-2 text-gray-300 font-medium">
                <Info className="w-4 h-4 text-amber-400" /> {tr.tips}
              </div>
              <p>• {tr.tip1}</p>
              <p>• {tr.tip2}</p>
              <p>• {tr.tip3}</p>
            </div>
          </div>

          {/* RIGHT — Style selection + result */}
          <div className="flex flex-col gap-6">
            {/* Presets */}
            <div>
              <p className="text-sm font-medium text-gray-300 mb-3">{tr.styleLabel}</p>
              <div className="grid grid-cols-2 gap-2">
                {tr.presets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedPreset(i === selectedPreset ? null : i);
                      setCustomStyle("");
                    }}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors text-left ${
                      selectedPreset === i
                        ? "bg-amber-400 text-[#111] border-amber-400"
                        : "bg-white/5 border-white/10 text-gray-300 hover:border-amber-400/40 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom style */}
            <div>
              <p className="text-sm font-medium text-gray-300 mb-2">{tr.customLabel}</p>
              <input
                type="text"
                value={customStyle}
                placeholder={tr.customPlaceholder}
                onChange={(e) => {
                  setCustomStyle(e.target.value);
                  if (e.target.value) setSelectedPreset(null);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="w-full flex items-center justify-center gap-2 bg-amber-400 text-[#111] font-bold py-4 rounded-xl text-base hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-[#111] border-t-transparent rounded-full" />
                  {tr.generatingBtn}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {tr.generateBtn}
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div>
                <p className="text-sm font-medium text-gray-300 mb-3">{tr.resultTitle}</p>
                <div className="rounded-2xl overflow-hidden border border-amber-400/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${result.mime_type};base64,${result.image}`}
                    alt="AI hairstyle preview"
                    className="w-full"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setResult(null); setSelectedPreset(null); setCustomStyle(""); }}
                    className="flex-1 py-3 rounded-xl border border-white/15 text-gray-300 hover:text-white hover:border-white/30 text-sm font-medium transition-colors"
                  >
                    {tr.tryAnother}
                  </button>
                  <Link
                    href="/book"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 text-[#111] font-bold text-sm hover:bg-amber-300 transition-colors"
                  >
                    {tr.bookNow} <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
