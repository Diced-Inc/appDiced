import {
  Banknote,
  CalendarClock,
  ChartColumn,
  CircleDollarSign,
  Download,
  Eye,
  History,
  Smartphone,
  Star,
  Sun,
  TrendingUp,
  Trophy,
} from "lucide-react";

// lucide-react — traço 1.75 casa com o peso do resto da UI (Syne/DM Sans)
const s = { className: "h-5 w-5", strokeWidth: 1.75, "aria-hidden": true } as const;

export const KpiIcons = {
  revenue: <CircleDollarSign {...s} />,
  receivable: <Banknote {...s} />,
  today: <Sun {...s} />,
  yesterday: <History {...s} />,
  average: <ChartColumn {...s} />,
  apps: <Smartphone {...s} />,
  downloads: <Download {...s} />,
  rating: <Star {...s} />,
  trophy: <Trophy {...s} />,
  impressions: <Eye {...s} />,
  trendingUp: <TrendingUp {...s} />,
  sameTime: <CalendarClock {...s} />,
};
