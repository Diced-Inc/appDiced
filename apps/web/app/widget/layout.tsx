export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <head>
        <title>Diced</title>
        <link rel="manifest" href="/manifest-widget.json" />
        <meta name="theme-color" content="#0c0a13" />
      </head>
      {children}
    </>
  );
}
