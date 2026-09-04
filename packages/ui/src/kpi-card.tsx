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
    <Card className="h-full min-w-0">
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-h-8 min-w-0 text-[11px] font-medium leading-4 text-zinc-400 sm:text-xs md:min-h-0 md:text-sm">
            {title}
          </p>
          <div className="shrink-0 rounded-lg bg-violet-500/10 p-2 text-violet-400 md:rounded-xl md:p-3">
            {icon}
          </div>
        </div>
        <p className="mt-3 whitespace-nowrap text-[clamp(1.125rem,5.8vw,1.75rem)] font-bold leading-none tracking-tight text-white font-heading tabular-nums md:mt-4 md:text-3xl">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-[11px] leading-4 text-zinc-400 md:text-xs">{subtitle}</p>
        )}
        {change && (
          <p className={`mt-1 text-[11px] leading-4 md:text-sm ${changeColor}`}>{change}</p>
        )}
      </div>
    </Card>
  );
}
