import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadBridge",
  description: "Internal CRM lead aggregation platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
