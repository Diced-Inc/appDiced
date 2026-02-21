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
  description: "Internal dashboard for Diced apps",
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
      >
        {children}
      </body>
    </html>
  );

  // Skip ClerkProvider when publishable key is not configured (e.g. during build)
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey || publishableKey === "pk_test_PLACEHOLDER") {
    return content;
  }

  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      {content}
    </ClerkProvider>
  );
}
