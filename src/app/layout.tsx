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
      <body className="p-3">
        <div className="mx-auto min-h-[calc(100vh-24px)] max-w-full overflow-hidden rounded-[16px] bg-[var(--color-surface)] shadow-[0_4px_24px_rgba(0,0,0,0.06),0_12px_48px_rgba(0,0,0,0.04)] md:rounded-[20px]">
          {children}
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}
