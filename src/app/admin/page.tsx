import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";
import { getAdminDashboardData } from "@/lib/server/admin-data";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Control Center | POOL BATTLE",
  description: "ศูนย์ควบคุมระบบสมาชิก สนาม การแข่งขัน คะแนน และกองรางวัล POOL BATTLE",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const initialData = await getAdminDashboardData();
  return <AdminConsole initialData={initialData} />;
}
