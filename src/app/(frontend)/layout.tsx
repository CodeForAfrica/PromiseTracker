import React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import theme from "@/theme/theme";
import { ThemeProvider } from "@mui/material";
import { Amiri, Open_Sans, Source_Sans_3 } from "next/font/google";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDomain } from "@/lib/domain";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import {
  PAYLOAD_SUPPORTED_LOCALES,
  type PayloadLocale,
  resolveTenantLocale,
} from "@/utils/locales";

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-amiri",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  display: "swap",
  variable: "--font-open-sans",
});

// Source Sans Pro is superseded by Source Sans 3 on Google Fonts
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["200", "300", "400", "600", "700"],
  display: "swap",
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  description: "PromiseTracker",
  title: "PromiseTracker",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export const resolveBrowserLocale = async (): Promise<PayloadLocale> => {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language");
  if (!acceptLanguage) {
    return "en";
  }

  const supported = new Set<PayloadLocale>(PAYLOAD_SUPPORTED_LOCALES);
  const candidates = acceptLanguage
    .split(",")
    .map((entry) => entry.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (supported.has(candidate as PayloadLocale)) {
      return candidate as PayloadLocale;
    }

    const [base] = candidate.split("-");
    if (base && supported.has(base as PayloadLocale)) {
      return base as PayloadLocale;
    }
  }

  return "en";
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  const { subdomain } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);
  const locale = tenant
    ? resolveTenantLocale(tenant)
    : await resolveBrowserLocale();

  return (
    <html
      lang={locale}
      className={`${amiri.variable} ${openSans.variable} ${sourceSans.variable}`}
    >
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
