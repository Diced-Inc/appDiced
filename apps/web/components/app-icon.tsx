import { Smartphone } from "lucide-react";

interface AppIconProps {
  icon: string;
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

/** Paleta fixa — o app cai sempre no mesmo tom em todas as telas. */
const tones = [
  "bg-violet-500/15 text-violet-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-blue-500/15 text-blue-300",
  "bg-amber-500/15 text-amber-300",
  "bg-rose-500/15 text-rose-300",
  "bg-cyan-500/15 text-cyan-300",
];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const raw = words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[1]![0]!;
  return raw.toUpperCase();
}

export function AppIcon({ icon, name, size = "md" }: AppIconProps) {
  if (icon.startsWith("http")) {
    return (
      <img
        src={icon}
        alt={name}
        loading="lazy"
        className={`${sizeClasses[size]} shrink-0 rounded-xl object-cover`}
      />
    );
  }

  const label = initials(name);

  return (
    <span
      aria-hidden="true"
      className={`${sizeClasses[size]} inline-flex shrink-0 items-center justify-center rounded-xl font-heading font-bold leading-none tracking-tight ${
        tones[hash(name) % tones.length]
      }`}
    >
      {label || <Smartphone className="h-4 w-4" strokeWidth={1.75} />}
    </span>
  );
}
