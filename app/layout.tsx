import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "./Navigation";
import { getProfiles } from "./actions";
import { cookies } from "next/headers";
import { ToastProvider } from "./Toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SC 주차 관리",
  description: "SC 제일은행 플래티넘 카드 무료 주차 횟수 관리 앱",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profiles = await getProfiles();
  const cookieStore = await cookies();
  const selectedProfileId = cookieStore.get('selected_profile_id')?.value || '';

  return (
    <html lang="ko">
      <body className={inter.className}>
        <ToastProvider>
          <Navigation profiles={profiles} initialProfileId={selectedProfileId} />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}