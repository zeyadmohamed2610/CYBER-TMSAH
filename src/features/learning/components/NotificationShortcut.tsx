import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { loadInbox } from "../services";

export function NotificationShortcut({ destination }: { destination: string }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      void loadInbox()
        .then((data) => {
          if (!cancelled) setUnread(data.unread);
        })
        .catch(() => {
          /* The inbox itself provides retry and error feedback. */
        });
    };
    check();
    const timer = setInterval(check, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return (
    <Link
      to={`${destination}?tab=followup&view=notifications`}
      aria-label={`الإشعارات${unread ? `، ${unread} غير مقروء` : ""}`}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground"
    >
      <Bell aria-hidden="true" className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -top-1 -end-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
