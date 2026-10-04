import Layout from "@/app/layouts/Layout";
import { StudentDashboard } from "./StudentDashboard";

const AttendanceStudentPage = () => (
  <Layout>
    <section className="section-container py-6 sm:py-8 md:py-10">
      <h1 className="mb-5 text-2xl font-extrabold">منصتي الأكاديمية</h1>
      <StudentDashboard />
    </section>
  </Layout>
);

export default AttendanceStudentPage;
