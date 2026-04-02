import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Check, X, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmActionProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "destructive" | "default" | "warning";
  onConfirm: () => void | Promise<void>;
  children: (trigger: () => void) => ReactNode;
  detailed?: boolean;
}

export function ConfirmAction({
  title,
  description,
  confirmLabel = "تأكيد",
  variant = "destructive",
  onConfirm,
  children,
  detailed = false,
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

  const getVariantStyles = () => {
    switch (variant) {
      case "destructive":
        return {
          icon: "bg-destructive/10",
          iconColor: "text-destructive",
          buttonVariant: "destructive" as const,
          bgColor: "bg-destructive/5",
        };
      case "warning":
        return {
          icon: "bg-amber-500/10",
          iconColor: "text-amber-500",
          buttonVariant: "default" as const,
          bgColor: "bg-amber-500/5",
        };
      default:
        return {
          icon: "bg-primary/10",
          iconColor: "text-primary",
          buttonVariant: "default" as const,
          bgColor: "bg-primary/5",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <>
      {children(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-lg transition-all duration-300" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={`relative z-10 w-full max-w-md rounded-2xl border-2 ${detailed ? "border-destructive/30" : "border-border"} bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${detailed ? styles.bgColor : ""}`}>
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
                {variant === "destructive" ? (
                  <Trash2 className={`h-6 w-6 ${styles.iconColor}`} />
                ) : variant === "warning" ? (
                  <AlertTriangle className={`h-6 w-6 ${styles.iconColor}`} />
                ) : (
                  <Info className={`h-6 w-6 ${styles.iconColor}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg text-foreground">{title}</h3>
                {description && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>}
              </div>
            </div>
            
            {detailed && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">ملاحظة:</span> هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            )}
            
            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={loading} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> إلغاء
              </Button>
              <Button
                variant={styles.buttonVariant}
                size="sm"
                onClick={handleConfirm}
                disabled={loading}
                className="gap-1.5"
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
