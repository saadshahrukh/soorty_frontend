import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import Toaster from "@/components/Toaster";
import ClientSessionGuard from "@/components/ClientSessionGuard";
import ReminderWatcher from "@/components/ReminderWatcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Business Financial Dashboard",
  description: "Manage your 3 businesses - Travel, Dates, and Belts",
  
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="fixed right-4 bottom-4 z-50">
          <ThemeToggle />
        </div>
        <Toaster />
        <ClientSessionGuard />
        <ReminderWatcher />
        {children}
      </body>
    </html>
  );
}
