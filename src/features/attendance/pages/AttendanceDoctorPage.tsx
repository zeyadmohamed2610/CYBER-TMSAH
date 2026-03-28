import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { DoctorDashboard } from "./DoctorDashboard";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { NotificationCenter } from "../components/NotificationCenter";

const AttendanceDoctorPage = () => {
  const { signOut } = useAttendanceAuth();

  return (
    <Layout>
      <section className="section-container py-10 md:py-14">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              لوحة تحكم الدكتور
            </p>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
              مركز الحضور — الدكتور
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <NotificationCenter />
            <Button variant="outline" size="sm" onClick={signOut} className="shrink-0 gap-1.5">
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </Button>
          </div>
        </div>
        <DoctorDashboard />
      </section>
    </Layout>
  );
};

export default AttendanceDoctorPage;
