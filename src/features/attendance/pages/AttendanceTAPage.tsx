import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { TADashboard } from "./TADashboard";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";

const AttendanceTAPage = () => {
  const { signOut } = useAttendanceAuth();

  return (
    <Layout>
      <section className="section-container py-10 md:py-14">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-500">
              لوحة تحكم المعيد
            </p>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
              مركز الحضور — المعيد
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="mt-2 shrink-0 gap-1.5">
            <LogOut className="h-4 w-4" />
            <span>تسجيل الخروج</span>
          </Button>
        </div>
        <TADashboard />
      </section>
    </Layout>
  );
};

export default AttendanceTAPage;
