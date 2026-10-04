import { useLang } from "@/shared/i18n";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { normalizeIdentifier } from "../utils/loginInput";

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
  dir = "auto",
  icon,
  suffix,
  badge,
  inputRef,
  autoFocus,
  onKeyDown,
  onKeyUp,
  error,
  enterKeyHint,
  readOnly,
  hint,
  inputMode,
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
  dir?: "ltr" | "rtl" | "auto";
  error?: string | null;
  enterKeyHint?: "next" | "go" | "send";
  readOnly?: boolean;
  hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  badge?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  const { isRTL } = useLang();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
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
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={enterKeyHint}
          inputMode={inputMode}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
            undefined
          }
          dir={dir}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full min-w-0 rounded-xl text-base sm:text-sm font-medium transition-all duration-200"
          style={{
            height: "46px",
            paddingRight: isRTL ? (icon ? "42px" : "14px") : suffix ? "58px" : "14px",
            paddingLeft: isRTL ? (suffix ? "58px" : "14px") : icon ? "42px" : "14px",
            background: focused ? "rgba(147, 51, 234, 0.08)" : "rgba(255,255,255,0.045)",
            border: `1.5px solid ${error ? "#F87171" : focused ? "#A855F7" : "rgba(255,255,255,0.12)"}`,
            color: "#FFFFFF",
            boxShadow: focused
              ? "0 0 0 3.5px rgba(147, 51, 234, 0.22), 0 2px 4px rgba(0,0,0,0.2)"
              : "0 1px 2px rgba(0,0,0,0.15)",
            outline: "none",
          }}
        />
        {suffix && <span className="absolute end-2.5 top-1/2 -translate-y-1/2 z-10">{suffix}</span>}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-300">
          {error}
        </p>
      )}
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
      aria-busy={Boolean(ld)}
      className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.985] cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2"
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
  const v = normalizeIdentifier(identifier);
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
