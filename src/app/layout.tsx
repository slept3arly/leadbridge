import type { Metadata } from "next";
import "./globals.css";
import "sonner/dist/styles.css";
import { Toaster } from "sonner";

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
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
