import { scheduleService } from "@/features/schedule/services/scheduleService";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/context/AuthContext";
import { canViewSchedule } from "../../auth/utils/roleAccess";
import { useAcademicClock } from "../hooks/useAcademicClock";
import {
  cairoDate,
  type AcademicEntry,
  type AcademicSchedule,
  type AcademicSettings,
} from "../utils/academicSchedule";
import { scheduleError } from "../utils/scheduleEditor";
import { exportScheduleWorkbook, ScheduleImportError } from "../utils/scheduleWorkbook";
import type { UniversityImport } from "../utils/universitySchedule";

export function useAcademicSchedule() {
  const { role, department: accountDepartment, departments } = useAuth();
  const scheduleAllowed = canViewSchedule(role);
  const [department, setDepartment] = useState("cybersecurity");
  const faculty = role === "doctor" || role === "ta";
  const scopedDepartment =
    role === "owner"
      ? department
      : faculty && departments.includes(department)
        ? department
        : accountDepartment;
  const availableDepartments =
    role === "owner" ? [] : faculty ? departments : accountDepartment ? [accountDepartment] : [];
  const [year, setYear] = useState("");
  const [data, setData] = useState<AcademicSchedule | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AcademicSettings | null>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState(1);
  const [view, setView] = useState(role === "student" ? "mine" : "all");
  const [previewCycle, setPreviewCycle] = useState("auto");
  const { now, synced } = useAcademicClock();
  const today = cairoDate(now);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const date = customDate ?? today;
  const [draft, setDraft] = useState<AcademicEntry | null>(null);
  const [imported, setImported] = useState<AcademicEntry[]>([]);
  const [importReview, setImportReview] = useState<UniversityImport | null>(null);
  const [importRevision, setImportRevision] = useState<string | null>(null);
  const [management, setManagement] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setError("");
    setData(null);
    if (!scheduleAllowed) return;
    if ((role === "owner" || role === "coordinator") && !year) return;
    const result = await scheduleService.get({
      p_department: role === "owner" || faculty ? scopedDepartment : null,
      p_year: role === "student" ? null : year || null,
    });
    if (version !== loadVersion.current) return;
    if (result.error) {
      setError(scheduleError(result.error.message));
      setData(null);
      return;
    }
    const next = result.data as AcademicSchedule;
    next.settings.days_off ??= [];
    setData(next);
    setSettingsDraft(null);
    if (next.student_section && /^[1-9]$|^1[0-5]$/.test(next.student_section))
      setSection(Number(next.student_section));
  }, [scopedDepartment, year, role, faculty, scheduleAllowed]);
  useEffect(() => {
    void load();
    setDraft(null);
    setImported([]);
    setImportReview(null);
  }, [load]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(
        e instanceof ScheduleImportError
          ? e.message
          : e instanceof Error
            ? scheduleError(e.message)
            : "تعذر تنفيذ الطلب",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!scheduleAllowed || management || ((role === "owner" || role === "coordinator") && !year))
      return;
    let active = true;
    const refresh = async () => {
      const version = loadVersion.current;
      const result = await scheduleService
        .get({
          p_department: role === "owner" || faculty ? scopedDepartment : null,
          p_year: role === "student" ? null : year || null,
        })
        .then(
          (result) => result,
          () => ({ data: null, error: true }),
        );
      if (active && version === loadVersion.current && !result.error && result.data)
        setData(result.data as AcademicSchedule);
    };
    const timer = setInterval(() => {
      void refresh();
    }, 60000);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [scopedDepartment, year, role, management, faculty, scheduleAllowed]);
  const saveEntry = () =>
    run(async () => {
      if (!data || !draft) return;
      const result = await scheduleService.saveEntry({
        p_department: data.department,
        p_year: data.academic_year,
        p_entry: draft,
      });
      if (result.error) throw new Error(result.error.message);
      setDraft(null);
      await load();
      toast.success("تم حفظ الحصة");
    });
  const download = (template: boolean) =>
    run(async () => {
      if (!data) return;
      const bytes = await exportScheduleWorkbook(data, template);
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = template
        ? "CYBER-TMSAH-template.xlsx"
        : `CYBER-TMSAH-${data.department}-${data.academic_year}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  return {
    error,
    load,
    data,
    settingsDraft,
    date,
    previewCycle,
    section,
    setDraft,
    role,
    busy,
    imported,
    availableDepartments,
    department: scopedDepartment ?? department,
    setDepartment: (value: string) => {
      setDepartment(value);
      setYear("");
    },
    year,
    setYear,
    management,
    setManagement,
    view,
    setSection,
    setView,
    setCustomDate,
    setPreviewCycle,
    now,
    synced,
    download,
    run,
    setImported,
    setImportReview,
    setImportRevision,
    today,
    setSettingsDraft,
    draft,
    saveEntry,
    importReview,
    importRevision,
  };
}
