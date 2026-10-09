import type { ReactNode } from "react";
export function StudentAttendanceAccess({ children }: { children: ReactNode }) {
  return (
    <>
      <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
        أول تأكيد حضور يعتمد مفتاح المرور المستخدم لحسابك. استخدم المفتاح نفسه لاحقًا؛ لتغييره اطلب
        من الإدارة إلغاء المفتاح السابق وإعادة الاعتماد. بعض المفاتيح تتزامن بين أجهزتك؛ الاعتماد
        يخص المفتاح ولا يثبت هاتفًا واحدًا.
      </p>
      {children}
    </>
  );
}
