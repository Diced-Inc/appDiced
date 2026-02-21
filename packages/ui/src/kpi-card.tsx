import { Card } from "./card";

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}

export function KpiCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
}: KpiCardProps) {
  const changeColor = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    neutral: "text-zinc-400",
  }[changeType];

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white font-heading">
            {value}
          </p>
          {change && (
            <p className={`mt-1 text-sm ${changeColor}`}>{change}</p>
          )}
        </div>
        <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
          {icon}
        </div>
      </div>
    </Card>
  );
}
