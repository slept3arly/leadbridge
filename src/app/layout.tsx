import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "LeadBridge",
  description: "Internal CRM lead aggregation platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-surface)] antialiased">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
