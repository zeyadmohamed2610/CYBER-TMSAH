import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  notify_date: string | null;
  notify_time: string | null;
  subject: string | null;
  created_at: string;
}

function getTypeIcon(type: string): string {
  switch (type) {
    case "exam": return "امتحان";
    case "quiz": return "كويز";
    case "reminder": return "تذكير";
    default: return "اعلان";
  }
}

function isUpcoming(n: Notification): boolean {
  if (!n.notify_date || !n.notify_time) return false;
  const t = new Date(n.notify_date + "T" + n.notify_time).getTime();
  return t > Date.now();
}

function getTimeUntil(n: Notification): string {
  if (!n.notify_date || !n.notify_time) return "الآن";
  const t = new Date(n.notify_date + "T" + n.notify_time).getTime();
  const diff = t - Date.now();
  if (diff <= 0) return "انتهى";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return d + " يوم";
  if (h > 0) return h + " ساعة";
  if (m > 0) return m + " دقيقة";
  return "أقل من دقيقة";
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alertedIds, setAlertedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("alerted_notifications");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const markAlerted = (id: string) => {
    setAlertedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("alerted_notifications", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const triggerAlarm = (n: Notification) => {
    if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 800]);
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(n.title, { body: n.body || n.subject || "تنبيه جديد" });
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
  };

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setNotifications((data ?? []) as Notification[]);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  // Alarm checker (every 1 second)
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const timer = setInterval(() => {
      notifications.forEach(n => {
        if (!alertedIds.has(n.id)) {
          if (!n.notify_date || !n.notify_time) {
            triggerAlarm(n);
            markAlerted(n.id);
          } else {
            const t = new Date(n.notify_date + "T" + n.notify_time).getTime();
            if (t <= Date.now()) {
              triggerAlarm(n);
              markAlerted(n.id);
            }
          }
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [notifications, alertedIds]);

  const upcoming = notifications.filter(isUpcoming);
  const past = notifications.filter(n => !isUpcoming(n)).slice(0, 10);
  const count = upcoming.length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${count > 0 ? "animate-pulse" : ""}`}>
        {count > 0 ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4" />}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 z-50 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-foreground">الاشعارات</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد اشعارات</p>
                </div>
              ) : (
                <>
                  {upcoming.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-primary mb-2 px-1">قادمة</p>
                      {upcoming.map(n => (
                        <div key={n.id} className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-2">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-bold text-foreground">{n.title}</h4>
                            <Badge variant="outline" className="text-[10px]">{getTypeIcon(n.type)}</Badge>
                          </div>
                          {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            {n.subject && <Badge variant="secondary" className="text-[10px]">{n.subject}</Badge>}
                            <span className="text-[10px] text-primary font-medium">{getTimeUntil(n)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {past.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-muted-foreground mb-2 px-1">سابقة / فورية</p>
                      {past.map(n => (
                        <div key={n.id} className="rounded-xl border border-border/50 bg-card/30 p-3 mb-2 opacity-70">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-bold text-muted-foreground">{n.title}</h4>
                            <Badge variant="outline" className="text-[10px] opacity-70">{getTypeIcon(n.type)}</Badge>
                          </div>
                          {n.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>}
                          {n.subject && <Badge variant="secondary" className="text-[10px] mt-1">{n.subject}</Badge>}
                        </div>
                      ))}
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
