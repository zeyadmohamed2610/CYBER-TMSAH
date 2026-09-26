// src/features/auth/components/PasswordStrengthMeter.tsx
import React from "react";

interface PasswordStrengthMeterProps {
  password: string;
  lang: string;
}

export function PasswordStrengthMeter({ password, lang }: PasswordStrengthMeterProps) {
  if (!password) return null;

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || (/[A-Z]/.test(password) && /[a-z]/.test(password))) score++;

  const config = [
    { label: lang === "ar" ? "ضعيفة" : "Weak", color: "bg-red-500", glow: "shadow-[0_0_8px_rgba(239,68,68,0.5)]" },
    { label: lang === "ar" ? "مقبولة" : "Fair", color: "bg-amber-500", glow: "shadow-[0_0_8px_rgba(245,158,11,0.5)]" },
    { label: lang === "ar" ? "جيدة" : "Good", color: "bg-purple-500", glow: "shadow-[0_0_8px_rgba(147,51,234,0.5)]" },
    { label: lang === "ar" ? "قوية جداً 🛡️" : "Very Strong 🛡️", color: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]" },
  ];

  const current = config[Math.max(0, score - 1)];

  return (
    <div className="space-y-1.5 pt-1 animate-fade-up">
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span className="text-muted-foreground">{lang === "ar" ? "قوة كلمة المرور:" : "Password Strength:"}</span>
        <span className={score >= 3 ? "text-primary" : score === 2 ? "text-amber-500" : "text-red-500"}>
          {current.label}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 h-1.5">
        {[1, 2, 3, 4].map((step) => {
          const active = score >= step;
          return (
            <div
              key={step}
              className={`h-full rounded-full transition-all duration-300 ${
                active ? `${current.color} ${current.glow}` : "bg-muted/40"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
