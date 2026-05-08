import type { Metadata, Viewport } from "next";
import { ThemeSync } from "@/shared/hooks/useTheme";
import { InAppBrowserBanner } from "@/shared/components/layout/InAppBrowserBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pic-paw — 어디서나 언제까지나",
  description: "반려동물 사진을 AI로 합성하는 반응형 웹 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-theme="A" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <InAppBrowserBanner />
        {children}
      </body>
    </html>
  );
}
