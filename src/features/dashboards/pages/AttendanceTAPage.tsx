import Layout from "@/app/layouts/Layout";
import { Button } from "@/shared/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";
import { TADashboard } from "./TADashboard";

const AttendanceTAPage = () => {
  const { signOut } = useAuth();

  return (
    <Layout>
      <section className="section-container py-6 sm:py-8 md:py-10 animate-fade-up">
        <div className="mb-6 sm:mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <span className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold tracking-wide text-cyan-500 backdrop-blur-sm">
              لوحة تحكم المعيد
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground md:text-3xl tracking-tight truncate">
              مركز الحضور — المعيد
            </h1>
          </div>
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              onClick={signOut}
              className="h-10 px-4 rounded-xl shadow-md shrink-0 gap-2 font-medium"
            >
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
