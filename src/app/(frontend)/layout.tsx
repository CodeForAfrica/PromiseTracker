import React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import theme from "@/theme/theme";
import { ThemeProvider } from "@mui/material";
import { Amiri, Open_Sans, Source_Sans_3 } from "next/font/google";
import type { Metadata } from "next";

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

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <html
      lang="en"
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
