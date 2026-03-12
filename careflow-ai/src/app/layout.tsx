import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "@/components/auth/auth-gate";

export const metadata: Metadata = {
  title: "CareFlow AI - 치과 리콜 관리 시스템",
  description: "환자 재내원 관리, 치료 중단 탐지, 리콜 자동화를 위한 운영 보조 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased bg-gray-50">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
