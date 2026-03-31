import type { Metadata } from "next";
import "./globals.css";
import Navigation from "./Navigation";
import { getProfiles } from "./actions";
import { cookies } from "next/headers";
import { ToastProvider } from "./Toast";

export const metadata: Metadata = {
  title: "SC 주차 관리",
  description: "SC 제일은행 플래티넘 카드 무료 주차 횟수 관리 앱",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "주차관리",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'auto';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            })();
          `,
        }} />
      </head>
      <body>
        <ToastProvider>
          <Navigation profiles={profiles} initialProfileId={selectedProfileId} />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
