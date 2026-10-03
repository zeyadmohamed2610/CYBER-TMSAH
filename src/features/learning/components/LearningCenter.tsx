import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { DEPARTMENTS } from "@/features/academics/types";
import { Button } from "@/shared/components/ui/button";
import { LoadingScreen } from "@/shared/components/Loading";
import { learningError } from "../errors";
import { learningRequest, loadInbox, loadOverview } from "../services";
import type { Inbox, Overview } from "../types";
import { RulesEditor } from "./RulesEditor";
import { TermManager } from "./TermManager";
import { CasesPanel } from "./CasesPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { ResultsPanel } from "./ResultsPanel";
import { useSearchParams } from "react-router-dom";

export function LearningCenter() {
  const { role, department } = useAuth();
  const [scope, setScope] = useState(department ?? "cybersecurity");
  const [term, setTerm] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get("view") ?? "results";
  const setTab = (value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("view", value);
        return next;
      },
      { replace: true },
    );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const manage = role === "owner" || role === "coordinator";
  const refresh = useCallback(async () => {
    const [overview, messages] = await Promise.all([loadOverview(scope, term), loadInbox()]);
    setData(overview);
    setInbox(messages);
  }, [scope, term]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    Promise.all([loadOverview(scope, term), loadInbox()])
      .then(([overview, messages]) => {
        if (!cancelled) {
          setData(overview);
          setInbox(messages);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(learningError(cause));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, term]);
  const run = (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    void operation()
      .then(refresh)
      .catch((cause) => setError(learningError(cause)))
      .finally(() => setBusy(false));
  };
  const tabs = [
    { id: "results", label: "النتائج" },
    { id: "cases", label: "الأعذار والمراجعة" },
    { id: "notifications", label: `الإشعارات${inbox?.unread ? ` (${inbox.unread})` : ""}` },
    ...(manage
      ? [
          { id: "terms", label: "الفصول الدراسية" },
          { id: "rules", label: "سياسة الغياب" },
          { id: "privacy", label: "حفظ البيانات" },
        ]
      : []),
  ];
  return (
    <div className="space-y-5" aria-busy={busy}>
      <div>
        <h2 className="text-xl font-bold">متابعة الدراسة</h2>
        <p className="text-sm text-muted-foreground mt-1">
          نتائج كل فصل، ومراجعة الغياب، وآخر الإشعارات.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {role === "owner" && (
          <label className="text-sm">
            القسم
            <select
              className="mt-2 w-full rounded-lg border bg-background p-2"
              value={scope}
              disabled={busy}
              onChange={(event) => {
                setData(null);
                setScope(event.target.value);
                setTerm(null);
              }}
            >
              {DEPARTMENTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nameAr}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          الفصل الدراسي
          <select
            className="mt-2 w-full rounded-lg border bg-background p-2"
            value={term ?? ""}
            disabled={busy}
            onChange={(event) => setTerm(event.target.value || null)}
          >
            <option value="">الفصل الحالي</option>
            {data?.terms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ·{" "}
                {item.status === "closed" ? "مؤرشف" : item.status === "draft" ? "تحضير" : "حالي"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-destructive">
          {error}
          <Button variant="ghost" onClick={() => run(refresh)}>
            إعادة المحاولة
          </Button>
        </p>
      )}
      <nav aria-label="أقسام متابعة الدراسة" className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "outline"}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      {busy && !data && <LoadingScreen message="جارٍ تحميل المتابعة..." />}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        {data && tab === "results" && <ResultsPanel rows={data.results} run={run} />}
        {data && tab === "cases" && (
          <CasesPanel data={data} student={role === "student"} run={run} />
        )}
        {inbox && tab === "notifications" && <NotificationsPanel inbox={inbox} run={run} />}
        {data && manage && tab === "terms" && <TermManager data={data} run={run} />}
        {data && manage && tab === "rules" && (
          <RulesEditor key={`${scope}:${term}`} data={data} run={run} />
        )}
        {data?.policy && manage && tab === "privacy" && (
          <form
            key={`${scope}:${data.policy.location_retention_days}:${data.policy.national_id_retention_days}`}
            className="rounded-2xl border bg-card p-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(new FormData(event.currentTarget));
              run(() =>
                learningRequest("academic_data_policy", {
                  p_department: scope,
                  p_payload: {
                    ...values,
                  },
                }),
              );
            }}
          >
            <h3 className="font-bold">مدة حفظ البيانات</h3>
            <p className="text-sm text-muted-foreground">
              لا توجد مدة مفروضة حاليًا، ولا يُحذف أي سجل تلقائيًا. تحدد الإدارة السياسة المعتمدة
              لاحقًا.
            </p>
            {(
              [
                { key: "location_retention_days", label: "بيانات الموقع — عدد الأيام" },
                { key: "national_id_retention_days", label: "الرقم القومي — عدد الأيام" },
              ] as const
            ).map((field) => (
              <label key={field.key} className="block text-sm">
                {field.label}
                <input
                  className="mt-2 w-full rounded-lg border bg-background p-2"
                  name={field.key}
                  type="number"
                  min="1"
                  defaultValue={data.policy?.[field.key] ?? ""}
                  placeholder="لم تُحدد المدة"
                />
              </label>
            ))}
            <Button type="submit">حفظ السياسة</Button>
          </form>
        )}
      </fieldset>
    </div>
  );
}
