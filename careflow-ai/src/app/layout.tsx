import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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
        <Sidebar />
        <div className="md:ml-64 min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
