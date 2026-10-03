import { useEffect, useState } from "react";
import { supabase } from "@/shared/api/supabaseClient";
import { Button } from "@/shared/components/ui/button";
import type { AcademicSchedule } from "../utils/academicSchedule";

interface Version {
  id: string;
  label: string;
  created_at: string;
  entries: number;
}
export function ScheduleVersions({
  schedule,
  busy,
  run,
  load,
}: {
  schedule: AcademicSchedule;
  busy: boolean;
  run: (operation: () => Promise<void>) => Promise<void>;
  load: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    void supabase
      .rpc("academic_schedule_versions", {
        p_department: schedule.department,
        p_year: schedule.academic_year,
      })
      .then(({ data, error: cause }) => {
        if (!cancelled) {
          setError(Boolean(cause));
          setVersions(cause ? [] : (data as Version[]));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [schedule.department, schedule.academic_year, schedule.revision]);
  return (
    <details className="rounded-2xl border p-4">
      <summary className="cursor-pointer font-bold">نسخ الجدول السابقة ({versions.length})</summary>
      <div className="mt-4 space-y-3">
        {error && <p role="alert">تعذر تحميل النسخ السابقة.</p>}
        {versions.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">ستُحفظ النسخ مع تعديل الجدول.</p>
        )}
        {versions.map((version) => (
          <div
            key={version.id}
            className="flex flex-wrap justify-between gap-3 rounded-xl border p-3"
          >
            <div>
              <p className="text-sm font-semibold">
                {version.label} · {version.entries} حصة
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(version.created_at).toLocaleString("ar-EG")}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy || !version.entries}
              onClick={() => {
                if (
                  window.confirm(
                    "استعادة هذه النسخة تستبدل حصص هذه الفرقة وإعداداتها. هل تريد المتابعة؟",
                  )
                )
                  void run(async () => {
                    const result = await supabase.rpc("academic_schedule_versions", {
                      p_department: schedule.department,
                      p_year: schedule.academic_year,
                      p_restore: version.id,
                      p_revision: schedule.revision,
                    });
                    if (result.error) throw result.error;
                    await load();
                  });
              }}
            >
              استعادة النسخة
            </Button>
          </div>
        ))}
      </div>
    </details>
  );
}
