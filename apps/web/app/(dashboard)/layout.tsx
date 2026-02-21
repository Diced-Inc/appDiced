import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="bg-surface-2 min-h-screen md:ml-64">{children}</main>
    </div>
  );
}
