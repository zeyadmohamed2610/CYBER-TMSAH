import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { OwnerDashboard } from "./OwnerDashboard";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";

const AttendanceOwnerPage = () => {
  const { role, signOut } = useAttendanceAuth();
  const isCoordinator = role === "coordinator";

  return (
    <Layout>
      <section className="section-container py-6 sm:py-10 md:py-14 animate-fade-up">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold tracking-wide text-primary backdrop-blur-sm">
              {isCoordinator ? "لوحة تحكم منسق البرنامج (رئيس قسم)" : "لوحة تحكم رئيس المنصة (المالك)"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground md:text-4xl tracking-tight truncate">
              {isCoordinator ? "مركز الحضور — منسق البرنامج" : "مركز الحضور — المالك العام"}
            </h1>
          </div>
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 shrink-0">
            <Button variant="destructive" size="sm" onClick={signOut} className="h-10 px-4 rounded-xl shadow-md shrink-0 gap-2 font-medium">
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </Button>
          </div>
        </div>
        <OwnerDashboard />
      </section>
    </Layout>
  );
};

export default AttendanceOwnerPage;
