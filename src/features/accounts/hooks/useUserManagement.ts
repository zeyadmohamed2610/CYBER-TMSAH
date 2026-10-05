import { DEPARTMENTS, type DepartmentInfo } from "@/features/academics/types";
import { supabase } from "@/shared/api/supabaseClient";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { notifyAcademicChange, useLiveRefresh } from "@/shared/hooks/useLiveRefresh";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/context/AuthContext";
import type { Subject, UserForm, UserRecord } from "../types/management";
const DEPARTMENTS_STORAGE_KEY = "cyber_departments_custom_names";
export function useUserManagement(initialRole = "all") {
  const { role: viewerRole, user: viewer } = useAuth();
  const [managedDepartment, setManagedDepartment] = useState<string | null>(null);
  const allowedRoles =
    viewerRole === "owner"
      ? ["coordinator", "doctor", "ta", "student"]
      : ["doctor", "ta", "student"];
  const [filterRole, setFilterRole] = useState(initialRole);
  const [role, setRole] = useState(initialRole === "all" ? "student" : initialRole);
  const loadVersion = useRef(0);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const debouncedSearch = useDebounce(search, 300);
  const DRAFT_KEY = `cyber_userlist_draft_${role}`;
  const [showCreate, setShowCreate] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved).showCreate ?? false;
    } catch {
      // fallback
    }
    return false;
  });
  const [submitting, setSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userSubjects, setUserSubjects] = useState<Record<string, Subject[]>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteInFlight = useRef(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const handleCopyText = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast.success(`تم نسخ ${fieldName}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("فشل النسخ إلى الحافظة");
    }
  };
  const [deptList] = useState<DepartmentInfo[]>(() => {
    try {
      const stored = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return DEPARTMENTS.map((dept) => ({
          ...dept,
          nameAr: parsed[dept.id] || dept.nameAr,
        }));
      }
    } catch {
      // fallback
    }
    return DEPARTMENTS;
  });
  const isDeptMatch = useCallback(
    (subjDept?: string | null, targetDept?: string | null) => {
      if (!subjDept || !targetDept) return true;
      if (subjDept === targetDept) return true;
      const foundSubj = deptList.find(
        (d) => d.id === subjDept || d.nameAr === subjDept || d.nameEn === subjDept,
      );
      const foundTarget = deptList.find(
        (d) => d.id === targetDept || d.nameAr === targetDept || d.nameEn === targetDept,
      );
      if (foundSubj && foundTarget && foundSubj.id === foundTarget.id) return true;
      return false;
    },
    [deptList],
  );
  const [formData, setFormData] = useState<UserForm>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) return { ...parsed.formData, password: "" };
      }
    } catch {
      // fallback
    }
    return {
      name: "",
      username: "",
      email: "",
      password: "",
      nationalId: "",
      department: "cybersecurity",
      academicYear: "1",
      sectionNumber: "1",
      subjectIds: [] as string[],
    };
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ showCreate, formData: { ...formData, password: "" } }),
      );
    } catch {
      // ignore
    }
  }, [showCreate, formData, DRAFT_KEY]);
  useEffect(() => {
    if (viewerRole !== "coordinator" || !viewer?.id) return;
    let active = true;
    void supabase
      .from("users")
      .select("department")
      .eq("auth_id", viewer.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.department) return;
        setManagedDepartment(data.department);
        setFormData((previous) => ({
          ...previous,
          department: data.department,
          subjectIds: previous.department === data.department ? previous.subjectIds : [],
        }));
      });
    return () => {
      active = false;
    };
  }, [viewerRole, viewer?.id]);
  const resetFormAndDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setShowCreate(false);
    setFormData({
      name: "",
      username: "",
      email: "",
      password: "",
      nationalId: "",
      department: managedDepartment ?? "cybersecurity",
      academicYear: "1",
      sectionNumber: "1",
      subjectIds: [] as string[],
    });
  }, [DRAFT_KEY, managedDepartment]);
  const [editData, setEditData] = useState({
    name: "",
    nationalId: "",
    department: "",
    departments: [] as string[],
    academicYear: "",
    sectionNumber: "",
    subjectIds: [] as string[],
  });
  useEffect(() => {
    supabase
      .from("subjects")
      .select("id, name, department")
      .then(({ data }) => {
        if (data) {
          const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, "ar"));
          setSubjects(sorted);
        }
      });
  }, []);
  const loadUserSubjects = useCallback(async (userIds: string[]) => {
    if (!userIds.length) return;
    const results: Record<string, Subject[]> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const { data } = await supabase.rpc("get_user_subjects", { p_user_id: uid });
        if (data) {
          results[uid] = (
            data as Array<{ subject_id: string; subject_name: string; department: string | null }>
          ).map((r) => ({ id: r.subject_id, name: r.subject_name, department: r.department }));
        } else {
          results[uid] = [];
        }
      }),
    );
    setUserSubjects((prev) => ({ ...prev, ...results }));
  }, []);
  const loadUsers = useCallback(
    async (silent = false) => {
      const version = ++loadVersion.current;
      if (!silent) setLoading(true);
      try {
        const collected: UserRecord[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase
            .from("users")
            .select(
              "id, full_name, username, email, role, national_id, subject_id, department, departments, academic_year, section_number, created_at",
            )
            .in(
              "role",
              viewerRole === "owner"
                ? ["coordinator", "doctor", "ta", "student"]
                : ["doctor", "ta", "student"],
            )
            .order("id")
            .range(offset, offset + 499);
          if (version !== loadVersion.current) return;
          if (error) throw error;
          collected.push(...data);
          if (data.length < 500) break;
        }
        const sortedData = collected.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
        setUsers(sortedData as UserRecord[]);
        // Load multi-subjects for doctors/TAs
        void loadUserSubjects(sortedData.filter((u) => u.role !== "student").map((u) => u.id));
        return true;
      } catch (err) {
        if (version !== loadVersion.current) return;
        console.error(err);
        toast.error("فشل تحميل قائمة المستخدمين");
        return false;
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
    },
    [viewerRole, loadUserSubjects],
  );
  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);
  useLiveRefresh(() => loadUsers(true), ["users", "user_subjects"]);
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedUsername = formData.username.trim().toLowerCase();
    const trimmedEmail = formData.email.trim().toLowerCase();

    // Validation
    const nameParts = trimmedName.split(/\s+/).filter(Boolean);
    if (nameParts.length < 3) {
      toast.error("يرجى إدخال الاسم ثلاثياً أو رباعياً على الأقل");
      return;
    }

    if (!trimmedUsername || trimmedUsername.length < 3) {
      toast.error("اسم المستخدم يجب أن يكون 3 أحرف على الأقل بدون مسافات");
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      toast.error("اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط");
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("يرجى إدخال بريد إلكتروني صالح");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    if ((role === "doctor" || role === "ta") && formData.subjectIds.length === 0) {
      toast.error("يرجى اختيار مادة واحدة على الأقل");
      return;
    }

    // Validate National ID for students
    if (role === "student") {
      const trimmedNID = formData.nationalId.trim();
      if (!trimmedNID || !/^\d{14}$/.test(trimmedNID)) {
        toast.error("الرقم القومي إلزامي للطالب ويجب أن يتكون من 14 رقماً بالضبط");
        return;
      }
    }

    setSubmitting(true);

    const trimmedNID = role === "student" ? formData.nationalId.trim() : null;

    try {
      // 1. Try Direct RPC admin_create_user
      const { data: newUserId, error: rpcError } = await supabase.rpc("admin_create_user", {
        p_full_name: trimmedName,
        p_username: trimmedUsername,
        p_email: trimmedEmail,
        p_password: formData.password,
        p_role: role,
        p_department: formData.department,
        p_academic_year: role === "student" ? formData.academicYear : null,
        p_section_number: role === "student" ? parseInt(formData.sectionNumber) : null,
        p_subject_id:
          (role === "doctor" || role === "ta" || role === "coordinator") &&
          formData.subjectIds.length > 0
            ? formData.subjectIds[0]
            : null,
      });

      // After user created, assign all subjects via junction table
      const assignSubjectsAfterCreate = async (userId: string) => {
        if (
          (role === "doctor" || role === "ta" || role === "coordinator") &&
          formData.subjectIds.length > 0
        ) {
          const assignment = await supabase.rpc("assign_user_subjects", {
            p_user_id: userId,
            p_subject_ids: formData.subjectIds,
          });
          if (assignment.error) throw new Error(assignment.error.message);
        }
      };

      if (rpcError) {
        if (rpcError.code !== "PGRST202" && rpcError.code !== "42883") {
          toast.error(
            getFriendlyErrorMessage(rpcError.message, "تعذر إنشاء الحساب. راجع البيانات."),
          );
          return;
        }
        // Fallback: If RPC not found yet or error, insert join_request and approve it immediately
        console.warn("admin_create_user RPC failed, using auto-approval fallback:", rpcError);

        const { data: joinReq, error: joinErr } = await supabase
          .from("join_requests")
          .insert({
            full_name: trimmedName,
            username: trimmedUsername,
            email: trimmedEmail,
            password: formData.password,
            role: role,
            department: formData.department,
            academic_year: role === "student" ? formData.academicYear : null,
            section_number: role === "student" ? parseInt(formData.sectionNumber) : null,
            national_id: trimmedNID,
            status: "pending",
          })
          .select("id")
          .single();

        if (joinErr) {
          if (joinErr.message.includes("duplicate") || joinErr.message.includes("username")) {
            toast.error("اسم المستخدم مسجل بالفعل. يرجى اختيار اسم مستخدم آخر.");
          } else {
            toast.error(getFriendlyErrorMessage(`فشل إنشاء المستخدم: ${joinErr.message}`));
          }
          setSubmitting(false);
          return;
        }

        // Approve it immediately
        const { data: approveResult, error: approveErr } = await supabase.rpc(
          "approve_join_request",
          {
            p_request_id: joinReq.id,
            p_temp_password: formData.password,
          },
        );

        if (approveErr) {
          toast.error(
            getFriendlyErrorMessage(
              `تم إنشاء الطلب ولكن فشل التفعيل المباشر: ${approveErr.message}`,
            ),
          );
        } else {
          // If coordinator, doctor, or TA had subjects selected, assign them
          const createdUid = (approveResult as { user_id?: string })?.user_id;
          if (createdUid && formData.subjectIds.length > 0) {
            await assignSubjectsAfterCreate(createdUid);
          }
          toast.success(`تمت إضافة الحساب بنجاح لـ ${trimmedName} ✓`);
          resetFormAndDraft();
          notifyAcademicChange();
          void loadUsers();
        }
      } else {
        // Assign multiple subjects if provided
        if (
          newUserId &&
          (role === "doctor" || role === "ta" || role === "coordinator") &&
          formData.subjectIds.length > 0
        ) {
          await assignSubjectsAfterCreate(newUserId as string);
        }
        // Set national_id for student via update (admin_create_user doesn't accept it yet)
        if (newUserId && role === "student" && trimmedNID) {
          const identity = await supabase
            .from("users")
            .update({ national_id: trimmedNID })
            .eq("id", newUserId as string);
          if (identity.error) throw new Error(identity.error.message);
        }
        toast.success(`تمت إضافة الحساب بنجاح لـ ${trimmedName} ✓`);
        resetFormAndDraft();
        notifyAcademicChange();
        void loadUsers();
      }
    } catch (err: unknown) {
      toast.error(
        getFriendlyErrorMessage(
          err instanceof Error ? err.message : "",
          "تعذر استكمال إنشاء الحساب. راجع قائمة المستخدمين قبل المحاولة مرة أخرى.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = async (userId: string, name: string) => {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeletingId(userId);
    try {
      const { error } = await supabase.rpc("delete_user_by_id", { p_user_id: userId });
      if (error) throw error;
      toast.success(`تم حذف "${name}" بنجاح`);
      setDeleteConfirm(null);
      notifyAcademicChange();
      await loadUsers(true);
    } catch (error) {
      toast.error(
        getFriendlyErrorMessage(
          error instanceof Error ? error.message : ((error as { message?: string })?.message ?? ""),
          "تعذر حذف الحساب. أعد المحاولة.",
        ),
      );
    } finally {
      deleteInFlight.current = false;
      setDeletingId(null);
    }
  };
  const startEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setEditData({
      name: user.full_name,
      nationalId: user.national_id || "",
      department: user.department || "cybersecurity",
      departments: user.departments?.length
        ? user.departments
        : [user.department || "cybersecurity"],
      academicYear: user.academic_year || "1",
      sectionNumber: user.section_number ? String(user.section_number) : "1",
      subjectIds:
        userSubjects[user.id]?.map((s) => s.id) ?? (user.subject_id ? [user.subject_id] : []),
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
  };
  const saveEdit = async (userId: string) => {
    if (!editData.name || editData.name.trim().length < 3) {
      toast.error("الاسم يجب أن يكون 3 أحرف على الأقل");
      return;
    }
    const role = users.find((user) => user.id === userId)?.role;
    setSubmitting(true);

    // Validate national_id if student
    if (
      role === "student" &&
      editData.nationalId.trim() &&
      !/^\d{14}$/.test(editData.nationalId.trim())
    ) {
      toast.error("الرقم القومي يجب أن يتكون من 14 رقماً بالضبط");
      setSubmitting(false);
      return;
    }

    const updatePayload: Record<string, unknown> = {
      full_name: editData.name.trim(),
      department: editData.department,
    };

    if ((role === "doctor" || role === "ta") && viewerRole === "owner") {
      if (!editData.departments.length) {
        toast.error("اختر قسمًا واحدًا على الأقل");
        setSubmitting(false);
        return;
      }
      updatePayload.departments = editData.departments;
      updatePayload.department = editData.departments[0];
      updatePayload.subject_id = null;
    }
    if (role === "student") {
      updatePayload.academic_year = editData.academicYear;
      updatePayload.section_number = parseInt(editData.sectionNumber) || 1;
      if (editData.nationalId.trim()) updatePayload.national_id = editData.nationalId.trim();
    }

    // Update basic user record
    const { error } = await supabase.from("users").update(updatePayload).eq("id", userId);

    if (error) {
      toast.error(getFriendlyErrorMessage("فشل تحديث البيانات: " + error.message));
      setSubmitting(false);
      return;
    }

    // For doctor/TA: update multi-subject assignments
    if (role === "doctor" || role === "ta" || role === "coordinator") {
      const { error: subjectErr } = await supabase.rpc("assign_user_subjects", {
        p_user_id: userId,
        p_subject_ids: editData.subjectIds,
      });
      if (subjectErr) {
        toast.error(
          getFriendlyErrorMessage("تم تحديث البيانات ولكن فشل تحديث المواد: " + subjectErr.message),
        );
        setSubmitting(false);
        return;
      }
    }

    toast.success("تم تحديث البيانات بنجاح ✓");
    setEditingId(null);
    void loadUsers();
    setSubmitting(false);
  };
  const getDepartmentLabel = (deptId?: string | null) => {
    if (!deptId) return "غير محدد";
    const found = deptList.find(
      (d) => d.id === deptId || d.nameAr === deptId || d.nameEn === deptId,
    );
    return found ? found.nameAr : deptId;
  };
  const getRoleLabel = (value = role) => {
    switch (value) {
      case "student":
        return "طالب";
      case "doctor":
        return "دكتور";
      case "ta":
        return "معيد";
      case "coordinator":
        return "رئيس قسم (منسق برنامج)";
      default:
        return "مستخدم";
    }
  };
  const filteredUsers = users.filter(
    (account) =>
      (filterRole === "all" || account.role === filterRole) &&
      [account.full_name, account.username, account.email, account.national_id].some((value) =>
        value?.toLocaleLowerCase().includes(debouncedSearch.trim().toLocaleLowerCase()),
      ),
  );
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / 25));
  const currentPage = Math.min(pageNumber, totalPages);
  useEffect(() => {
    setPageNumber(1);
  }, [filterRole, debouncedSearch]);
  return {
    users,
    setShowCreate,
    showCreate,
    allowedRoles,
    getRoleLabel,
    filterRole,
    setFilterRole,
    setEditingId,
    setDeleteConfirm,
    handleCreate,
    role,
    setRole,
    submitting,
    formData,
    setFormData,
    showPassword,
    setShowPassword,
    deptList,
    viewerRole,
    managedDepartment,
    subjects,
    isDeptMatch,
    resetFormAndDraft,
    search,
    setSearch,
    loading,
    filteredUsers,
    currentPage,
    editingId,
    editData,
    setEditData,
    setSelectedUserForDetails,
    getDepartmentLabel,
    userSubjects,
    cancelEdit,
    saveEdit,
    deleteConfirm,
    deletingId,
    handleDelete,
    startEdit,
    totalPages,
    setPageNumber,
    selectedUserForDetails,
    handleCopyText,
    copiedField,
  };
}
