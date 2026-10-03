import { Button } from "@/shared/components/ui/button";
import { loadInbox } from "../services";
import type { Inbox } from "../types";

const categories = {
  schedule: "الجدول",
  attendance: "الحضور",
  request: "طلبات المراجعة",
  exam: "الامتحانات",
  term: "الفصول الدراسية",
  announcement: "الإعلانات",
};
export function NotificationsPanel({
  inbox,
  run,
}: {
  inbox: Inbox;
  run: (operation: () => Promise<unknown>) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-bold">الإشعارات · {inbox.unread} غير مقروء</h3>
        <Button
          variant="outline"
          disabled={!inbox.unread}
          onClick={() => run(() => loadInbox("read"))}
        >
          تحديد الكل كمقروء
        </Button>
      </div>
      <fieldset className="rounded-2xl border p-4">
        <legend className="px-2 text-sm">الإشعارات التي ترغب في تلقيها</legend>
        <div className="flex flex-wrap gap-4">
          {Object.entries(categories).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!inbox.muted.includes(value)}
                onChange={(event) =>
                  run(() =>
                    loadInbox("preferences", {
                      muted: event.target.checked
                        ? inbox.muted.filter((item) => item !== value)
                        : [...inbox.muted, value],
                    }),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {inbox.items.length === 0 && (
        <p className="text-muted-foreground p-5">لا توجد إشعارات جديدة.</p>
      )}
      {inbox.items.map((item) => (
        <article
          key={item.id}
          className={`rounded-2xl border bg-card p-4 space-y-2 ${item.read_at ? "" : "border-primary/40"}`}
        >
          <h4 className="font-bold">{item.title}</h4>
          <p className="text-sm break-words">{item.body}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleString("ar-EG")}
          </p>
          {!item.read_at && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => run(() => loadInbox("read", { id: item.id }))}
            >
              تمت القراءة
            </Button>
          )}
        </article>
      ))}
    </section>
  );
}
