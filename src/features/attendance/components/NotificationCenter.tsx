import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  notify_date: string;
  notify_time: string;
  subject: string;
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
  const t = new Date(n.notify_date + "T" + n.notify_time).getTime();
  return t > Date.now();
}

function getTimeUntil(n: Notification): string {
  const t = new Date(n.notify_date + "T" + n.notify_time).getTime();
  const diff = t - Date.now();
  if (diff <= 0) return "انتهى";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return d + " يوم";
  if (h > 0) return h + " ساعة";
  return "قريباً";
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setNotifications((data ?? []) as Notification[]);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const upcoming = notifications.filter(isUpcoming);
  const past = notifications.filter(n => !isUpcoming(n)).slice(0, 10);
  const count = upcoming.length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
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
                      <p className="text-xs font-bold text-muted-foreground mb-2 px-1">سابقة</p>
                      {past.map(n => (
                        <div key={n.id} className="rounded-xl border border-border/50 bg-card/30 p-3 mb-2 opacity-70">
                          <h4 className="text-sm font-bold text-muted-foreground">{n.title}</h4>
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
