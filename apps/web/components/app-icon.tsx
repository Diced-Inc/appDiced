interface AppIconProps {
  icon: string;
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const textSizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

export function AppIcon({ icon, name, size = "md" }: AppIconProps) {
  if (icon.startsWith("http")) {
    return (
      <img
        src={icon}
        alt={name}
        className={`${sizeClasses[size]} shrink-0 rounded-xl object-cover`}
      />
    );
  }

  return (
    <span className={`${textSizes[size]} shrink-0`}>{icon || "📱"}</span>
  );
}
