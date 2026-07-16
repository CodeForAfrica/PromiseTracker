import React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import theme from "@/theme/theme";
import { ThemeProvider } from "@mui/material";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { getDomain } from "@/lib/domain";
import { resolveBrowserLocale } from "@/lib/locale";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import { resolveTenantLocale } from "@/utils/locales";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  description: "PromiseTracker",
  title: "PromiseTracker",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  const { subdomain } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);
  const locale = tenant
    ? resolveTenantLocale(tenant)
    : await resolveBrowserLocale();

  return (
    <html lang={locale} className={`${inter.variable}`}>
      <body style={{ margin: 0 }}>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <main>{children}</main>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
