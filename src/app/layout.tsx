import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthModalProvider } from "@/components/auth/auth-modal";
import { LoginQueryOpener } from "@/components/auth/login-trigger";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { themeScript } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { site } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: {
    title: site.name,
    description: site.description,
    locale: "es_CR",
    type: "website",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = isSupabaseConfigured ? await getCurrentUser() : null;

  return (
    <html
      lang="es-CR"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      // El script del tema toca el dataset antes de hidratar.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <ToastProvider>
          <AuthModalProvider authenticated={Boolean(user)}>
            <Suspense fallback={null}>
              <LoginQueryOpener />
            </Suspense>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </AuthModalProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
