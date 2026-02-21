import { UserButton } from "@clerk/nextjs";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/5 px-4 md:h-16 md:px-6">
      <h1 className="pl-10 text-lg font-bold font-heading md:pl-0 md:text-xl">{title}</h1>
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
