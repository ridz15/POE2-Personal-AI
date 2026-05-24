import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PoE2 Personal AI",
  description: "Personal market analysis workspace for Path of Exile 2.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
