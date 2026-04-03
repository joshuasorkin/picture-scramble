import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Utu's Wild Words",
  description: "AI-generated word scramble game with fine art",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
