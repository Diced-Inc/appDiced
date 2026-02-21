import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-heading",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Diced Dashboard",
  description: "Painel interno para apps da Diced",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <html lang="pt-BR">
      <body
        className={`${syne.variable} ${dmSans.variable} font-body bg-surface text-white antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );

  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      {content}
    </ClerkProvider>
  );
}
