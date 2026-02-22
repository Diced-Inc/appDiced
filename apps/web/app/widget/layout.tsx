import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Diced",
  manifest: "/manifest-widget.json",
};

export const viewport: Viewport = {
  themeColor: "#0c0a13",
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
