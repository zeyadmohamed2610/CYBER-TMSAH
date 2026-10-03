import { ACADEMIC_YEARS, DEPARTMENTS } from "@/features/academics/types";
import { CustomRoleSelect } from "@/features/auth/components/CustomRoleSelect";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import type { JoinRole, useLoginForm } from "../hooks/useLoginForm";
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
    academicYear,
    setAcademicYear,
    sectionNumber,
    setSectionNumber,
    joinNationalId,
    setJoinNationalId,
    joinLoading,
    handleTabChange,
    handleJoin,
    isStudent,
  } = model;
  return (
    <form onSubmit={handleJoin} className="space-y-3.5">
      {/* English 3-part Full Name */}
      <Field
        id="j-name"
        label={lang === "ar" ? "الاسم ثلاثي بالإنجليزية" : "Full Name (English - 3 parts)"}
        value={fullName}
        onChange={setFullName}
        placeholder={lang === "ar" ? "مثال: Ahmed Mohamed Ali" : "e.g. John David Smith"}
        required
        dir="ltr"
        icon={<Icon.User />}
      />

      {/* Real Email */}
      <Field
        id="j-email"
        type="email"
        label={lang === "ar" ? "البريد الإلكتروني" : "Email Address"}
        value={joinEmail}
        onChange={setJoinEmail}
        placeholder="name@gmail.com"
        required
        dir="ltr"
        icon={<Icon.Mail />}
      />

      {/* Unique Username */}
      <Field
        id="j-user"
        label={lang === "ar" ? "اسم المستخدم (فريد)" : "Unique Username"}
        value={joinUsername}
        onChange={setJoinUsername}
        placeholder={lang === "ar" ? "مثال: ahmed_ali" : "e.g. ahmed_ali"}
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
            label={t.auth.password}
            type={showJoinPass ? "text" : "password"}
            value={joinPassword}
            onChange={setJoinPassword}
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
            label={lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
            type={showConfirmPass ? "text" : "password"}
            value={confirmPassword}
            onChange={setConfirmPassword}
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
        label={t.auth.chooseRole}
        value={joinRole}
        onChange={(v) => setJoinRole(v as JoinRole)}
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

      {/* Department (The 7 departments for all roles) */}
      <CustomRoleSelect
        id="j-dept"
        label={lang === "ar" ? "القسم التابع له (7 أقسام)" : "Department (7 Disciplines)"}
        value={department}
        onChange={setDepartment}
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

      {/* Student Specific Fields: National ID, Academic Year & Section Number */}
      {isStudent && (
        <div className="space-y-3">
          <Field
            id="j-national-id"
            name="national_id"
            label={
              lang === "ar" ? "الرقم القومي للطالب (14 رقماً)" : "Student National ID (14 digits)"
            }
            value={joinNationalId}
            onChange={(v) => {
              const clean = v.replace(/\D/g, "").slice(0, 14);
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
              label={lang === "ar" ? "الفرقة الدراسية" : "Academic Year"}
              value={academicYear}
              onChange={setAcademicYear}
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
              label={lang === "ar" ? "رقم السكشن" : "Section Number"}
              type="number"
              value={sectionNumber}
              onChange={setSectionNumber}
              placeholder={lang === "ar" ? "مثال: 1" : "e.g. 1"}
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

      <p className="text-center text-[12.5px] pt-1.5 text-slate-400">
        {lang === "ar" ? "لديك حساب؟" : "Have an account?"}{" "}
        <button
          type="button"
          onClick={() => handleTabChange("login")}
          className="font-semibold text-purple-400 hover:text-purple-300 cursor-pointer transition-colors"
        >
          {t.auth.signIn}
        </button>
      </p>
    </form>
  );
}
