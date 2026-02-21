import { UserButton } from "@clerk/nextjs";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/5 px-6">
      <h1 className="text-xl font-bold font-heading">{title}</h1>
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-9 w-9",
          },
        }}
      />
    </header>
  );
}
