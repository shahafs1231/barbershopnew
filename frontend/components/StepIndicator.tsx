import { Check } from "lucide-react";

interface Step {
  label: string;
}

interface Props {
  steps: Step[];
  current: number; // 0-based
}

export default function StepIndicator({ steps, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto pb-2">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-xs mt-1 font-medium whitespace-nowrap ${
                  active ? "text-[#1a1a1a]" : done ? "text-green-600" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-10 h-0.5 mb-5 mx-1 transition-all ${
                  done ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
