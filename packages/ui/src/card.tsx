interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-white/5 bg-surface-2 p-4 md:rounded-2xl md:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
