interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-surface-2 p-6 ${className}`}
    >
      {children}
    </div>
  );
}
