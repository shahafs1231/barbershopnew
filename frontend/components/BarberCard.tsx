import { Check } from "lucide-react";
import type { Barber } from "@/lib/api";
import { BASE } from "@/lib/api";

interface Props {
  barber: Barber;
  selected: boolean;
  onSelect: () => void;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function BarberCard({ barber, selected, onSelect }: Props) {
  const photoSrc = barber.photo_url ? `${BASE}${barber.photo_url}` : null;

  return (
    <button
      onClick={onSelect}
      className={`relative w-full flex flex-col items-center rounded-2xl border-2 p-6 transition-all ${
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

      {/* Avatar / Photo */}
      {photoSrc ? (
        <img
          src={photoSrc}
          alt={barber.name}
          className="w-16 h-16 rounded-full object-cover mb-3 ring-2 ring-white/30"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white mb-3"
          style={{ backgroundColor: selected ? "#ffffff30" : barber.avatar_color }}
        >
          {initials(barber.name)}
        </div>
      )}

      <h3 className="font-bold text-base text-center">{barber.name}</h3>
      {barber.specialty && (
        <p className={`text-xs mt-1 text-center leading-relaxed ${selected ? "text-gray-300" : "text-gray-500"}`}>
          {barber.specialty}
        </p>
      )}
    </button>
  );
}
