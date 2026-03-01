import { Check } from "lucide-react";
import type { Service } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";

const categoryColors: Record<string, string> = {
  haircut: "bg-blue-50 text-blue-700 border-blue-200",
  beard: "bg-orange-50 text-orange-700 border-orange-200",
  combo: "bg-purple-50 text-purple-700 border-purple-200",
  accessories: "bg-green-50 text-green-700 border-green-200",
};

interface Props {
  service: Service;
  selected: boolean;
  onToggle: () => void;
}

export default function ServiceCard({ service, selected, onToggle }: Props) {
  const { t } = useLanguage();
  const colorClass = categoryColors[service.category] ?? "bg-gray-50 text-gray-700 border-gray-200";
  const categoryLabel = t.services.categories[service.category as keyof typeof t.services.categories] ?? service.category;
  const displayName = t.services.names[service.name] ?? service.name;
  const displayDesc = service.description ? (t.services.descriptions[service.description] ?? service.description) : null;

  return (
    <button
      onClick={onToggle}
      className={`relative w-full text-left rounded-2xl border-2 p-5 transition-all ${
        selected
          ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
          : "border-gray-200 bg-white hover:border-gray-400"
      }`}
    >
      {selected && (
        <span className="absolute top-3 end-3 bg-amber-400 rounded-full p-0.5">
          <Check className="w-4 h-4 text-[#1a1a1a]" />
        </span>
      )}
      <span
        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mb-2 ${
          selected ? "bg-white/20 text-white border-white/30" : colorClass
        }`}
      >
        {categoryLabel}
      </span>
      <h3 className="font-bold text-base">{displayName}</h3>
      {displayDesc && (
        <p className={`text-sm mt-1 ${selected ? "text-gray-300" : "text-gray-500"}`}>
          {displayDesc}
        </p>
      )}
      <div className="flex items-center gap-3 mt-3">
        <span className="text-lg font-black">₪{service.price}</span>
        <span className={`text-xs ${selected ? "text-gray-300" : "text-gray-400"}`}>
          ~{service.duration_minutes} {t.services.approxMin}
        </span>
      </div>
    </button>
  );
}
