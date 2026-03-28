import { useEffect, useState, useCallback } from "react";
import { Bell, BellRing, Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notificationService, type Notification } from "../services/notificationService";
import { toast } from "sonner";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [upcoming, setUpcoming] = useState<Notification[]>([]);
  const [past, setPast] = useState<Notification[]>([]);

  const refresh = useCallback(() => {
    setUnread(notificationService.getUnreadCount());
    setUpcoming(notificationService.getUpcoming());
    setPast(notificationService.getPast().slice(0, 10));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const { due24h, due1h } = notificationService.checkReminders();
    for (const n of due24h) {
      toast.message(`تذكير: ${n.title}`, {
        description: `بعد يوم - ${n.subject ?? ""}`,
        duration: 8000,
      });
    }
    for (const n of due1h) {
      toast.warning(`تذكير عاجل: ${n.title}`, {
        description: `بعد ساعة - ${n.subject ?? ""}`,
        duration: 10000,
      });
    }
    if (due24h.length > 0 || due1h.length > 0) refresh();
  }, [upcoming, refresh]);

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead();
    refresh();
  };

  const handleDelete = (id: string) => {
    notificationService.remove(id);
    refresh();
  };

  const handleClearPast = () => {
    notificationService.clearPast();
    refresh();
  };

  const renderNotification = (n: Notification, showDelete = true) => {
    const icon = notificationService.getTypeIcon(n.type);
    const label = notificationService.getTypeLabel(n.type);
    const timeUntil = notificationService.getTimeUntil(n);
    const isPastEvent = notificationService.isUpcoming(n) === false;

    return (
      <div
        key={n.id}
        className={`relative flex gap-3 p-3 rounded-xl border transition-colors ${
          !n.read && !isPastEvent
            ? "border-primary/30 bg-primary/5"
            : "border-border/50 bg-card/30"
        }`}
      >
        <div className="text-xl shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-bold truncate ${
              !n.read && !isPastEvent ? "text-foreground" : "text-muted-foreground"
            }`}>
              {n.title}
            </h4>
            {showDelete && (
              <button
                onClick={() => handleDelete(n.id)}
                className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{label}</Badge>
            {n.subject && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{n.subject}</Badge>
            )}
            <span className={`text-[10px] ${isPastEvent ? "text-muted-foreground" : "text-primary font-medium"}`}>
              {isPastEvent ? "انتهى" : timeUntil}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="الإشعارات"
      >
        {unread > 0 ? (
          <BellRing className="h-4 w-4 text-primary" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 z-50 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-foreground">الإشعارات</h3>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs h-7 gap-1">
                    <Check className="h-3 w-3" />
                    قراءة الكل
                  </Button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2">
              {upcoming.length === 0 && past.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
                  <p className="text-xs text-muted-foreground mt-1">سيظهر هنا مواعيد الامتحانات والكويزات</p>
                </div>
              ) : (
                <>
                  {upcoming.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-primary mb-2 px-1">قادمة</p>
                      <div className="space-y-2">
                        {upcoming.map(n => renderNotification(n))}
                      </div>
                    </div>
                  )}
                  {past.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <p className="text-xs font-bold text-muted-foreground">سابقة</p>
                        <button
                          onClick={handleClearPast}
                          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          مسح السابقة
                        </button>
                      </div>
                      <div className="space-y-2 opacity-70">
                        {past.map(n => renderNotification(n))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
