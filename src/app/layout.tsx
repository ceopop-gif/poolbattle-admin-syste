import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "@fontsource/noto-sans-thai/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "POOL BATTLE | ระบบสมาชิก",
  description:
    "ระบบสมาชิก POOL BATTLE สำหรับบัตรผ่านประตู คิวเล่น การแข่งขัน คะแนน และอันดับ",
  applicationName: "POOL BATTLE",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#061b13",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
