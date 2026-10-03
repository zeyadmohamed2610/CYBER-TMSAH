import { useLang } from "@/shared/i18n";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function Field({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  dir = "ltr",
  icon,
  suffix,
  badge,
  inputRef,
  autoFocus,
  onKeyDown,
  onKeyUp,
}: {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  dir?: "ltr" | "rtl";
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  badge?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label
          htmlFor={id}
          className="block text-[12px] font-semibold tracking-wide select-none transition-colors duration-150"
          style={{ color: focused ? "#C084FC" : "#CBD5E1" }}
        >
          {label}
        </label>
        {badge}
      </div>
      <div className="relative">
        {icon && (
          <span
            className="absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-colors duration-200"
            style={{ color: focused ? "#C084FC" : "#94A3B8" }}
          >
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          dir={dir}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            height: "46px",
            paddingInlineStart: icon ? "42px" : "14px",
            paddingInlineEnd: suffix ? "44px" : "14px",
            background: focused ? "rgba(147, 51, 234, 0.08)" : "rgba(255,255,255,0.045)",
            border: `1.5px solid ${focused ? "#A855F7" : "rgba(255,255,255,0.12)"}`,
            color: "#FFFFFF",
            boxShadow: focused
              ? "0 0 0 3.5px rgba(147, 51, 234, 0.22), 0 2px 4px rgba(0,0,0,0.2)"
              : "0 1px 2px rgba(0,0,0,0.15)",
            outline: "none",
          }}
        />
        {suffix && <span className="absolute end-2.5 top-1/2 -translate-y-1/2 z-10">{suffix}</span>}
      </div>
    </div>
  );
}
export const PrimaryButton = ({
  children,
  loading: ld,
  disabled,
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
}) => {
  const { t } = useLang();
  return (
    <button
      type="submit"
      disabled={disabled || ld}
      className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.985] cursor-pointer"
      style={{
        height: "46px",
        background: "linear-gradient(180deg, #9333EA 0%, #7E22CE 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.25) inset, 0 4px 18px rgba(147,51,234,0.5), 0 2px 4px rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "linear-gradient(180deg, #A855F7 0%, #9333EA 100%)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "linear-gradient(180deg, #9333EA 0%, #7E22CE 100%)")
      }
    >
      {ld ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t.auth.signingIn}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
export function IdentifierBadge({ identifier }: { identifier: string }) {
  const { lang } = useLang();
  const v = identifier.trim();
  if (!v) return null;
  const [bg, color, border, label] = /^\d{14}$/.test(v)
    ? [
        "rgba(99,102,241,0.12)",
        "#818CF8",
        "rgba(99,102,241,0.3)",
        lang === "ar" ? "رقم قومي" : "National ID",
      ]
    : /^\d+$/.test(v)
      ? ["rgba(245,158,11,0.1)", "#F59E0B", "rgba(245,158,11,0.25)", lang === "ar" ? "رقم" : "ID"]
      : v.includes("@")
        ? [
            "rgba(16,185,129,0.08)",
            "#34D399",
            "rgba(16,185,129,0.2)",
            lang === "ar" ? "بريد" : "Email",
          ]
        : [
            "rgba(255,255,255,0.06)",
            "#94A3B8",
            "rgba(255,255,255,0.12)",
            lang === "ar" ? "اسم مستخدم" : "Username",
          ];
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}
