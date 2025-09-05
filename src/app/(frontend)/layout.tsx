import React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
export const metadata = {
  description: "PromiseTracker",
  title: "PromiseTracker",
};
import theme from "@/theme/theme";
import { ThemeProvider } from "@mui/material";

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
        }}
      >
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <main>{children}</main>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
