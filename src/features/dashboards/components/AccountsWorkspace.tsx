import { useSearchParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { UserList } from "@/features/accounts/components/UserList";
import { JoinRequestsPanel } from "@/features/accounts/components/JoinRequestsPanel";
import { DeviceLockPanel } from "@/features/attendance/components/DeviceLockPanel";
import { FixesReportsPanel } from "@/features/reports/components/FixesReportsPanel";
export function AccountsWorkspace({
  initialRole = "all",
  pending = 0,
}: {
  initialRole?: string;
  pending?: number;
}) {
  const [params, setParams] = useSearchParams();
  const choices = [
    { id: "accounts", label: "الحسابات" },
    { id: "requests", label: "طلبات الانضمام والاستعادة" },
    { id: "devices", label: "أجهزة الحضور" },
    { id: "fixes", label: "بلاغات المشاكل" },
  ];
  const legacy = params.get("tab");
  const requested =
    params.get("manage") ??
    (["requests", "devices", "fixes"].includes(legacy ?? "") ? legacy : "accounts");
  const current = choices.some((item) => item.id === requested) ? requested : "accounts";
  return (
    <section className="space-y-4" aria-label="المستخدمون والطلبات">
      <header>
        <h2 className="text-xl font-bold">المستخدمون والطلبات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          إدارة الحسابات ومراجعة الانضمام ومتابعة طلبات الدعم في مكان واحد.
        </p>
      </header>
      <nav aria-label="إدارة المستخدمين والطلبات" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {choices.map((item) => (
          <Button
            key={item.id}
            variant={current === item.id ? "default" : "outline"}
            aria-pressed={current === item.id}
            className="h-auto min-h-11 whitespace-normal"
            onClick={() =>
              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("tab", "users");
                  next.set("manage", item.id);
                  return next;
                },
                { replace: true },
              )
            }
          >
            {item.label}
            {item.id === "requests" && pending > 0 && (
              <span className="rounded-full bg-background/25 px-2 text-xs">{pending}</span>
            )}
          </Button>
        ))}
      </nav>
      {current === "accounts" && <UserList role={initialRole} />}
      {current === "requests" && <JoinRequestsPanel />}
      {current === "devices" && <DeviceLockPanel />}
      {current === "fixes" && <FixesReportsPanel />}
    </section>
  );
}
