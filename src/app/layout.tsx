import type { Metadata } from "next";
import SessionProvider from "./SessionProvider";
// KHIA Learning Hub 브랜드 폰트(Plus Jakarta Sans) - @fontsource로 self-host
// (Google Fonts CDN을 직접 fetch하지 않아 오프라인/네트워크 제한 환경에서도 항상 로드됨)
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "My KHIA - 학부모 포탈",
  description: "My KHIA 학부모 포탈 시스템",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
