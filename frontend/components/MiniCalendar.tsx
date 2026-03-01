"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Translations } from "@/lib/translations";

const OPEN_DAYS = new Set([0, 2, 3, 4, 5]);

function isOpen(date: Date): boolean {
  return OPEN_DAYS.has(date.getDay());
}

function isFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

function toYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface Props {
  selected: string | null;
  onSelect: (date: string) => void;
  cal: Translations["calendar"];
}

export default function MiniCalendar({ selected, onSelect, cal }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 select-none max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-gray-900">
          {cal.months[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 transition">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {cal.days.map((d, i) => (
          <div
            key={i}
            className={`text-center text-xs font-semibold py-1 ${
              i === 1 || i === 6 ? "text-gray-300" : "text-gray-500"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} />;
          const open = isOpen(date) && isFuture(date);
          const ymd = toYMD(date);
          const isSelected = ymd === selected;
          const isToday = ymd === toYMD(today);

          return (
            <button
              key={idx}
              disabled={!open}
              onClick={() => onSelect(ymd)}
              className={`
                w-full aspect-square rounded-full text-sm font-medium transition-all
                ${isSelected ? "bg-[#1a1a1a] text-white font-bold" : ""}
                ${!isSelected && open ? "hover:bg-amber-100 text-gray-900" : ""}
                ${!open ? "text-gray-300 cursor-not-allowed" : ""}
                ${isToday && !isSelected ? "ring-2 ring-amber-400" : ""}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full ring-2 ring-amber-400 inline-block" /> {cal.today}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" /> {cal.closed}
        </span>
      </div>
    </div>
  );
}
