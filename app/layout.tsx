import type { Metadata } from "next";
import "./globals.css";
import { BackToTopButton } from "@/components/back-to-top-button";

export const metadata: Metadata = {
  title: "CIS — Collaborative Investigation Sleuths",
  description: "CIS — Collaborative Investigation Sleuths workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="mx-auto min-h-screen w-full max-w-[1400px] bg-background px-4 md:px-6 lg:px-12">
          {children}
        </div>
        <BackToTopButton />
      </body>
    </html>
  );
}
