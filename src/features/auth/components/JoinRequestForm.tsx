import { ACADEMIC_YEARS, DEPARTMENTS } from "@/features/academics/types";
import { CustomRoleSelect } from "@/features/auth/components/CustomRoleSelect";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { normalizeDigits } from "../utils/loginInput";
import type { JoinField, JoinRole, useLoginForm } from "../hooks/useLoginForm";
import { Field, PrimaryButton as PrimaryBtn } from "./AuthFormControls";
import { AuthIcons as Icon } from "./AuthIcons";

export function JoinRequestForm({ model }: { model: ReturnType<typeof useLoginForm> }) {
  const {
    t,
    lang,
    isRTL,
    joinRole,
    setJoinRole,
    fullName,
    setFullName,
    joinEmail,
    setJoinEmail,
    joinUsername,
    setJoinUsername,
    joinPassword,
    setJoinPassword,
    confirmPassword,
    setConfirmPassword,
    showJoinPass,
    setShowJoinPass,
    showConfirmPass,
    setShowConfirmPass,
    department,
    setDepartment,
    joinDepartments,
    setJoinDepartments,
    academicYear,
    setAcademicYear,
    sectionNumber,
    setSectionNumber,
    joinNationalId,
    setJoinNationalId,
    joinLoading,
    joinError,
    clearJoinError,
    handleJoin,
    isStudent,
  } = model;
  const errorFor = (field: JoinField) => (joinError?.field === field ? joinError.message : null);
  const update = (field: JoinField, setter: (value: string) => void) => (value: string) => {
    setter(value);
    clearJoinError(field);
  };
  return (
    <form onSubmit={handleJoin} noValidate aria-busy={joinLoading}>
      <fieldset disabled={joinLoading} className="min-w-0 space-y-3.5">
        {/* English 3-part Full Name */}
        <Field
          id="j-name"
          name="full_name"
          autoComplete="name"
          error={errorFor("j-name")}
          label={lang === "ar" ? "الاسم ثلاثي بالإنجليزية" : "Full Name (English - 3 parts)"}
          value={fullName}
          onChange={update("j-name", setFullName)}
          placeholder={lang === "ar" ? "example: Ahmed Mohamed Ali" : "e.g. John David Smith"}
          required
          dir="ltr"
          icon={<Icon.User />}
        />

        {/* Real Email */}
        <Field
          id="j-email"
          name="email"
          autoComplete="email"
          error={errorFor("j-email")}
          type="email"
          label={lang === "ar" ? "البريد الإلكتروني" : "Email Address"}
          value={joinEmail}
          onChange={update("j-email", setJoinEmail)}
          placeholder="name@gmail.com"
          required
          dir="ltr"
          icon={<Icon.Mail />}
        />

        {/* Unique Username */}
        <Field
          id="j-user"
          name="username"
          hint="من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو شرطة سفلية (_) دون مسافات."
          error={errorFor("j-user")}
          label={lang === "ar" ? "اسم المستخدم" : "Unique Username"}
          value={joinUsername}
          onChange={update("j-user", setJoinUsername)}
          placeholder={lang === "ar" ? "example: ahmed_ali" : "e.g. ahmed_ali"}
          required
          dir="ltr"
          autoComplete="username"
          icon={<Icon.User />}
        />

        {/* Password & Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Field
              id="j-pass"
              error={errorFor("j-pass")}
              label={t.auth.password}
              type={showJoinPass ? "text" : "password"}
              value={joinPassword}
              onChange={update("j-pass", setJoinPassword)}
              placeholder="••••••••"
              required
              dir="ltr"
              autoComplete="new-password"
              icon={<Icon.Lock />}
              suffix={
                <button
                  type="button"
                  aria-label={
                    showJoinPass
                      ? lang === "ar"
                        ? "إخفاء كلمة المرور"
                        : "Hide password"
                      : lang === "ar"
                        ? "إظهار كلمة المرور"
                        : "Show password"
                  }
                  aria-pressed={showJoinPass}
                  onClick={() => setShowJoinPass((v) => !v)}
                  className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer transition-colors text-slate-400 hover:text-white"
                >
                  <Icon.Eye off={showJoinPass} />
                </button>
              }
            />
          </div>
          <div>
            <Field
              id="j-confirm-pass"
              error={errorFor("j-confirm-pass")}
              label={lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
              type={showConfirmPass ? "text" : "password"}
              value={confirmPassword}
              onChange={update("j-confirm-pass", setConfirmPassword)}
              placeholder="••••••••"
              required
              dir="ltr"
              autoComplete="new-password"
              icon={<Icon.Lock />}
              suffix={
                <button
                  type="button"
                  aria-label={
                    showConfirmPass
                      ? lang === "ar"
                        ? "إخفاء كلمة المرور"
                        : "Hide password"
                      : lang === "ar"
                        ? "إظهار كلمة المرور"
                        : "Show password"
                  }
                  aria-pressed={showConfirmPass}
                  onClick={() => setShowConfirmPass((v) => !v)}
                  className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer transition-colors text-slate-400 hover:text-white"
                >
                  <Icon.Eye off={showConfirmPass} />
                </button>
              }
            />
          </div>
        </div>
        <PasswordStrengthMeter password={joinPassword} lang={lang} />

        {/* Choose Role */}
        <CustomRoleSelect
          id="j-role"
          error={errorFor("j-role")}
          label={t.auth.chooseRole}
          value={joinRole}
          onChange={(v) => {
            setJoinRole(v as JoinRole);
            clearJoinError();
          }}
          icon={<Icon.Tag />}
          options={[
            {
              value: "coordinator",
              label: lang === "ar" ? "منسق البرنامج (رئيس قسم)" : "Program Coordinator / Dept Head",
            },
            { value: "doctor", label: lang === "ar" ? "دكتور مادة" : "Doctor / Professor" },
            { value: "ta", label: lang === "ar" ? "معيد" : "Teaching Assistant (TA)" },
            { value: "student", label: lang === "ar" ? "طالب" : "Student" },
          ]}
          labelColor="#CBD5E1"
          fieldBg="rgba(255,255,255,0.045)"
          fieldBorder="rgba(255,255,255,0.12)"
          fieldFocus="rgba(147,51,234,0.08)"
          fieldGlow="0 0 0 3px rgba(147,51,234,0.22)"
          textColor="#FFFFFF"
          faintColor="#94A3B8"
          isRTL={isRTL}
        />

        <p className="text-xs leading-5 text-slate-400">
          اختيار الرتبة والقسم هو طلب للمراجعة؛ يُفعّل الحساب وتُمنح الصلاحيات بعد موافقة الإدارة.
        </p>

        {/* Faculty can request membership in several departments. */}
        {joinRole === "doctor" || joinRole === "ta" ? (
          <fieldset
            id="j-departments"
            tabIndex={-1}
            aria-invalid={Boolean(errorFor("j-departments"))}
            aria-describedby={errorFor("j-departments") ? "j-departments-error" : undefined}
            className="space-y-3 rounded-xl border border-white/10 p-3"
          >
            <legend className="px-2 text-sm font-semibold">
              {lang === "ar" ? "الأقسام التي تعمل بها" : "Your departments"}
            </legend>
            <p className="text-xs text-slate-400">
              {lang === "ar"
                ? "اختر قسمًا أو أكثر. تُعتمد الأقسام والمواد بعد مراجعة طلبك."
                : "Select one or more departments, subject to approval."}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEPARTMENTS.map((d) => (
                <label
                  key={d.id}
                  className="flex min-h-11 items-center gap-3 rounded-lg bg-white/5 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={joinDepartments.includes(d.id)}
                    onChange={(e) => {
                      clearJoinError("j-departments");
                      setJoinDepartments((previous) =>
                        e.target.checked
                          ? [...previous, d.id]
                          : previous.filter((id) => id !== d.id),
                      );
                    }}
                    className="h-4 w-4 accent-purple-500"
                  />
                  {lang === "ar" ? d.nameAr : d.nameEn}
                </label>
              ))}
            </div>
            {errorFor("j-departments") && (
              <p id="j-departments-error" role="alert" className="text-xs text-red-300">
                {errorFor("j-departments")}
              </p>
            )}
          </fieldset>
        ) : (
          <CustomRoleSelect
            id="j-dept"
            error={errorFor("j-dept")}
            label={lang === "ar" ? "القسم التابع له (7 أقسام)" : "Department (7 Disciplines)"}
            value={department}
            onChange={update("j-dept", setDepartment)}
            icon={<Icon.Dept />}
            options={DEPARTMENTS.map((d) => ({
              value: d.id,
              label: lang === "ar" ? d.nameAr : d.nameEn,
            }))}
            labelColor="#CBD5E1"
            fieldBg="rgba(255,255,255,0.045)"
            fieldBorder="rgba(255,255,255,0.12)"
            fieldFocus="rgba(147,51,234,0.08)"
            fieldGlow="0 0 0 3px rgba(147,51,234,0.22)"
            textColor="#FFFFFF"
            faintColor="#94A3B8"
            isRTL={isRTL}
          />
        )}

        {/* Student Specific Fields: National ID, Academic Year & Section Number */}
        {isStudent && (
          <div className="space-y-3">
            <Field
              id="j-national-id"
              error={errorFor("j-national-id")}
              name="national_id"
              inputMode="numeric"
              label={
                lang === "ar" ? "الرقم القومي للطالب (14 رقماً)" : "Student National ID (14 digits)"
              }
              value={joinNationalId}
              onChange={(v) => {
                const clean = normalizeDigits(v).replace(/\D/g, "").slice(0, 14);
                clearJoinError("j-national-id");
                setJoinNationalId(clean);
              }}
              placeholder="2990101XXXXXXXXX"
              required
              dir="ltr"
              autoComplete="off"
              icon={<Icon.User />}
              badge={
                joinNationalId.length > 0 ? (
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background:
                        joinNationalId.length === 14
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(245,158,11,0.15)",
                      color: joinNationalId.length === 14 ? "#34D399" : "#FBBF24",
                    }}
                  >
                    {joinNationalId.length}/14
                  </span>
                ) : null
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CustomRoleSelect
                id="j-year"
                error={errorFor("j-year")}
                label={lang === "ar" ? "الفرقة الدراسية" : "Academic Year"}
                value={academicYear}
                onChange={update("j-year", setAcademicYear)}
                icon={<Icon.Year />}
                options={ACADEMIC_YEARS.map((y) => ({
                  value: y.id,
                  label: lang === "ar" ? y.nameAr : y.nameEn,
                }))}
                labelColor="#CBD5E1"
                fieldBg="rgba(255,255,255,0.045)"
                fieldBorder="rgba(255,255,255,0.12)"
                fieldFocus="rgba(147,51,234,0.08)"
                fieldGlow="0 0 0 3px rgba(147,51,234,0.22)"
                textColor="#FFFFFF"
                faintColor="#94A3B8"
                isRTL={isRTL}
              />

              <Field
                id="j-sec"
                error={errorFor("j-sec")}
                label={lang === "ar" ? "رقم السكشن" : "Section Number"}
                type="text"
                inputMode="numeric"
                value={sectionNumber}
                onChange={update("j-sec", setSectionNumber)}
                placeholder={lang === "ar" ? "example: 1" : "e.g. 1"}
                required
                icon={<Icon.Hash />}
              />
            </div>
          </div>
        )}

        <div className="pt-1.5">
          <PrimaryBtn loading={joinLoading}>
            <Icon.UserPlus />
            <span>{t.auth.submitRequest}</span>
          </PrimaryBtn>
        </div>
      </fieldset>
      {joinError && !joinError.field && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs leading-5 text-red-300"
        >
          {joinError.message}
        </p>
      )}
    </form>
  );
}
