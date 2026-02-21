import { Header } from "@/components/header";
import { Card } from "@diced/ui/card";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div>
      <Header title="Settings" />
      <div className="p-6">
        <Card>
          <h2 className="text-lg font-semibold font-heading">Settings</h2>
          <p className="mt-2 text-sm text-zinc-400">
            API integrations and preferences will be available here in a future update.
          </p>
        </Card>
      </div>
    </div>
  );
}
