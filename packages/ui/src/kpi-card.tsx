import { Card } from "./card";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}

export function KpiCard({
  title,
  value,
  subtitle,
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
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-400 md:text-sm">{title}</p>
          <p className="mt-1 truncate text-2xl font-bold text-white font-heading md:mt-2 md:text-3xl">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-zinc-400">{subtitle}</p>
          )}
          {change && (
            <p className={`mt-1 text-xs md:text-sm ${changeColor}`}>{change}</p>
          )}
        </div>
        <div className="ml-2 shrink-0 rounded-xl bg-violet-500/10 p-2 text-violet-400 md:p-3">
          {icon}
        </div>
      </div>
    </Card>
  );
}
