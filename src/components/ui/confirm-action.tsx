import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmActionProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void | Promise<void>;
  children: (trigger: () => void) => ReactNode;
}

export function ConfirmAction({
  title,
  description,
  confirmLabel = "تأكيد",
  variant = "destructive",
  onConfirm,
  children,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      {children(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${variant === "destructive" ? "bg-destructive/10" : "bg-primary/10"}`}>
                <AlertTriangle className={`h-5 w-5 ${variant === "destructive" ? "text-destructive" : "text-primary"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-foreground">{title}</h3>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={loading} className="gap-1">
                <X className="h-3.5 w-3.5" /> إلغاء
              </Button>
              <Button
                variant={variant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={handleConfirm}
                disabled={loading}
                className="gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                {loading ? "جاري التنفيذ..." : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
