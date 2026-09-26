// src/features/auth/components/CustomRoleSelect.tsx
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Tag } from "lucide-react";

export interface RoleOption {
  value: string;
  label: string;
  icon?: string;
  badge?: string;
}

interface CustomRoleSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: RoleOption[];
  icon?: React.ReactNode;
  labelColor?: string;
  fieldBg?: string;
  fieldBorder?: string;
  fieldFocus?: string;
  fieldGlow?: string;
  textColor?: string;
  faintColor?: string;
  isRTL?: boolean;
}

export function CustomRoleSelect({
  id,
  label,
  value,
  onChange,
  options,
  icon,
  labelColor = "#CBD5E1",
  fieldBg = "rgba(255, 255, 255, 0.045)",
  fieldBorder = "rgba(255, 255, 255, 0.12)",
  fieldFocus = "rgba(99, 102, 241, 0.08)",
  fieldGlow = "0 0 0 3.5px rgba(99, 102, 241, 0.22), 0 2px 8px rgba(0,0,0,0.3)",
  textColor = "#FFFFFF",
  faintColor = "#94A3B8",
  isRTL = true,
}: CustomRoleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If space below is less than 170px, open upwards to avoid clipping
      setOpenUp(spaceBelow < 170 && rect.top > 170);
    }
  }, [isOpen]);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative" ref={ref}>
      <label
        htmlFor={id}
        style={{ color: isOpen ? "#C084FC" : labelColor }}
        className="block text-[12px] font-semibold tracking-wide mb-1.5 select-none transition-colors duration-150"
      >
        {label}
      </label>

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          background: isOpen ? "rgba(147, 51, 234, 0.12)" : fieldBg,
          border: `1.5px solid ${isOpen ? "#A855F7" : fieldBorder}`,
          color: textColor,
          boxShadow: isOpen ? "0 0 0 3.5px rgba(147, 51, 234, 0.25), 0 2px 8px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.15)",
        }}
        className="w-full h-[46px] px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all duration-200 cursor-pointer select-none group outline-none"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="transition-colors duration-200"
            style={{ color: isOpen ? "#C084FC" : faintColor }}
          >
            {icon || <Tag className="w-4 h-4" />}
          </span>
          <div className="flex items-center gap-2">
            {selected?.icon && <span className="text-base">{selected.icon}</span>}
            <span className="font-bold text-white">{selected?.label}</span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          style={{ color: isOpen ? "#C084FC" : faintColor }}
        />
      </button>

      {/* Floating 100% Solid Opaque Dropdown Menu (No bleed-through) */}
      {isOpen && (
        <div
          className={`absolute z-[100] start-0 end-0 p-1.5 rounded-2xl border shadow-2xl transition-all duration-150 max-h-64 overflow-y-auto ${
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{
            backgroundColor: "#060A14", // 100% solid opaque background - absolutely no elements bleed through
            borderColor: "rgba(168, 85, 247, 0.45)",
            boxShadow: "0 25px 70px rgba(0,0,0,0.98), 0 0 35px rgba(147, 51, 234, 0.25)",
          }}
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="space-y-1">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    background: active ? "rgba(147, 51, 234, 0.22)" : "transparent",
                    border: `1px solid ${active ? "rgba(168, 85, 247, 0.5)" : "transparent"}`,
                    color: active ? "#FFFFFF" : "#CBD5E1",
                    boxShadow: active ? "0 0 16px rgba(147, 51, 234, 0.3)" : "none",
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer text-start hover:bg-purple-500/15 hover:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    {opt.icon && <span className="text-base">{opt.icon}</span>}
                    <span className="text-xs font-bold">{opt.label}</span>
                  </div>
                  {active && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: "#C084FC",
                        boxShadow: "0 0 10px #C084FC",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
