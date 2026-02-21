import { Sidebar } from "@/components/sidebar";
import { AutoSync } from "@/components/auto-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Sidebar />
      <AutoSync />
      <main className="bg-surface-2 min-h-screen overflow-x-hidden md:ml-64">{children}</main>
    </div>
  );
}
