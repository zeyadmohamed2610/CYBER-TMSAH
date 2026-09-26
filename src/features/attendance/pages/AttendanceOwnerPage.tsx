import Layout from "@/components/Layout";
import { OwnerDashboard } from "./OwnerDashboard";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";

const AttendanceOwnerPage = () => {
  const { role, fullName } = useAttendanceAuth();
  const isCoordinator = role === "coordinator";

  return (
    <Layout>
      <section className="section-container py-6 sm:py-8 md:py-10 animate-fade-up">
        {/* Clean, purposeful header without clunky badges or duplicate logout buttons */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isCoordinator ? "لوحة الإشراف الأكاديمي" : "لوحة الإدارة الأكاديمية"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              مرحباً بك {fullName ? `، ${fullName}` : ""} · نظام إدارة الحضور والغياب الأكاديمي
            </p>
          </div>
        </div>

        <OwnerDashboard />
      </section>
    </Layout>
  );
};

export default AttendanceOwnerPage;
