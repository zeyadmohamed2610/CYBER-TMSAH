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
  labelColor = "rgba(148, 163, 184, 0.8)",
  fieldBg = "rgba(255, 255, 255, 0.04)",
  fieldBorder = "rgba(255, 255, 255, 0.09)",
  fieldFocus = "rgba(255, 255, 255, 0.08)",
  fieldGlow = "0 0 20px hsl(187 92% 50% / 0.22), 0 0 0 1.5px hsl(187 92% 50% / 0.45)",
  textColor = "#f8fafc",
  faintColor = "rgba(148, 163, 184, 0.55)",
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
        style={{ color: labelColor }}
        className="block text-[10.5px] font-bold tracking-[0.12em] uppercase mb-1.5 select-none"
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
          border: `1px solid ${isOpen ? "hsl(187,92%,46%)" : fieldBorder}`,
          color: textColor,
          boxShadow: isOpen ? fieldGlow : "inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
        className="w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all duration-200 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="transition-colors duration-200"
            style={{ color: isOpen ? "hsl(187,92%,46%)" : faintColor }}
          >
            {icon || <Tag className="w-4 h-4" />}
          </span>
          <div className="flex items-center gap-2">
            {selected?.icon && <span className="text-sm">{selected.icon}</span>}
            <span className="font-bold text-slate-100">{selected?.label}</span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`}
          style={{ color: isOpen ? "hsl(187,92%,46%)" : faintColor }}
        />
      </button>

      {/* Floating Cyber Glass Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute z-50 start-0 end-0 mt-2 p-1.5 rounded-2xl backdrop-blur-2xl border shadow-2xl animate-fade-up overflow-hidden"
          style={{
            background: "rgba(11, 19, 38, 0.98)",
            borderColor: "rgba(6, 182, 212, 0.35)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.95), 0 0 25px rgba(6,182,212,0.18)",
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer text-start ${
                    active
                      ? "bg-primary/20 text-primary border border-primary/40 shadow-[0_0_12px_hsl(187_92%_46%/0.25)]"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.08] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {opt.icon && <span className="text-base">{opt.icon}</span>}
                    <span className="text-xs font-bold">{opt.label}</span>
                  </div>
                  {active && (
                    <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(187_92%_46%)]" />
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
