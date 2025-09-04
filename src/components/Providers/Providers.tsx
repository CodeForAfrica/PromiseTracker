"use client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { CacheProvider } from "@emotion/react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { DefaultSeo } from "next-seo";
import React from "react";

import SEO from "@/next-seo.config";
import theme from "@/theme/index";
import createCache from "@emotion/cache";

const isBrowser = typeof document !== "undefined";

function createEmotionCache() {
  let insertionPoint: HTMLElement | undefined;

  if (isBrowser) {
    const emotionInsertionPoint = document.querySelector(
      'meta[name="emotion-insertion-point"]',
    );
    insertionPoint = (emotionInsertionPoint as HTMLElement) ?? undefined;
  }

  return createCache({ key: "mui-style", insertionPoint });
}
// simplebar-react has a hard dependency on simplebar

import "simplebar-react/dist/simplebar.min.css";

function Providers(props: { children: React.ReactNode }) {
  const { children } = props;
  const [mounted, setMounted] = React.useState(false);
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const emotionCache = createEmotionCache();

  React.useEffect(() => {
    setMounted(true);
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side");
    if (jssStyles) {
      jssStyles?.parentElement?.removeChild(jssStyles);
    }
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <>
      <DefaultSeo {...SEO} />
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={theme}>
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
          <CssBaseline />
          {children}
        </ThemeProvider>
      </CacheProvider>
      <GoogleAnalytics gaId={gaID || ""} />
    </>
  );
}

export default Providers;
