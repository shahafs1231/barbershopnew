import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";

export const metadata: Metadata = {
  title: "BarberShop — Book Your Appointment",
  description: "Professional barbershop booking system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#f8f7f4]">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
