import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { TADashboard } from "./TADashboard";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";

const AttendanceTAPage = () => {
  const { signOut } = useAttendanceAuth();

  return (
    <Layout>
      <section className="section-container py-6 sm:py-10 md:py-14 animate-fade-up">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <span className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold tracking-wide text-cyan-500 backdrop-blur-sm">
              لوحة تحكم المعيد
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground md:text-4xl tracking-tight truncate">
              مركز الحضور — المعيد
            </h1>
          </div>
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 shrink-0">
            <Button variant="destructive" size="sm" onClick={signOut} className="h-10 px-4 rounded-xl shadow-md shrink-0 gap-2 font-medium">
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </Button>
          </div>
        </div>
        <TADashboard />
      </section>
    </Layout>
  );
};

export default AttendanceTAPage;
