import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthModalProvider } from "@/components/auth/auth-modal";
import { LoginQueryOpener } from "@/components/auth/login-trigger";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { themeScript } from "@/components/theme-toggle";
import { ToastOnParam } from "@/components/toast-on-param";
import { ToastProvider } from "@/components/ui/toast";
import { site } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { enabledProviders } from "@/lib/supabase/providers";
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
  const [user, providers] = await Promise.all([
    isSupabaseConfigured ? getCurrentUser() : null,
    enabledProviders(),
  ]);

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
          <AuthModalProvider authenticated={Boolean(user)} providers={providers}>
            <Suspense fallback={null}>
              <LoginQueryOpener />
              <ToastOnParam
                param="auth_error"
                message="No pudimos completar el ingreso. Proba de nuevo."
              />
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
