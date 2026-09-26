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

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative" ref={ref}>
      <label
        htmlFor={id}
        style={{ color: isOpen ? "#818CF8" : labelColor }}
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
          background: isOpen ? fieldFocus : fieldBg,
          border: `1.5px solid ${isOpen ? "#6366F1" : fieldBorder}`,
          color: textColor,
          boxShadow: isOpen ? fieldGlow : "0 1px 2px rgba(0,0,0,0.15)",
        }}
        className="w-full h-[46px] px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all duration-200 cursor-pointer select-none group outline-none"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="transition-colors duration-200"
            style={{ color: isOpen ? "#818CF8" : faintColor }}
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
          style={{ color: isOpen ? "#818CF8" : faintColor }}
        />
      </button>

      {/* Floating Glass Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute z-50 start-0 end-0 mt-2 p-1.5 rounded-2xl backdrop-blur-2xl border shadow-2xl overflow-hidden"
          style={{
            background: "rgba(10, 15, 29, 0.98)",
            borderColor: "rgba(99, 102, 241, 0.35)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.95), 0 0 25px rgba(99, 102, 241, 0.2)",
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
                    background: active ? "rgba(99, 102, 241, 0.18)" : "transparent",
                    border: `1px solid ${active ? "rgba(99, 102, 241, 0.45)" : "transparent"}`,
                    color: active ? "#FFFFFF" : "#CBD5E1",
                    boxShadow: active ? "0 0 14px rgba(99, 102, 241, 0.25)" : "none",
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer text-start hover:bg-white/[0.08] hover:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    {opt.icon && <span className="text-base">{opt.icon}</span>}
                    <span className="text-xs font-bold">{opt.label}</span>
                  </div>
                  {active && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: "#818CF8",
                        boxShadow: "0 0 8px #818CF8",
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
