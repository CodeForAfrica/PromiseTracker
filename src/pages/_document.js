import React from "react";

import Document, { Html, Head, Main, NextScript } from "next/document";

import { ServerStyleSheets } from "@material-ui/core/styles";

import theme from "@/promisetracker/theme/index";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* PWA primary color */}
          <meta name="theme-color" content={theme.palette.primary.main} />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
          <link
            rel="preload"
            href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Merriweather:wght@300;400;700&family=Open+Sans:wght@300;400;600;700&family=Source+Sans+Pro:wght@200;300;400;600;700&display=swap"
            as="style"
          />
          {/* Add rel as stylesheet  https://stackoverflow.com/questions/50824181/preloading-google-fonts */}
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Merriweather:wght@300;400;700&family=Open+Sans:wght@300;400;600;700&family=Source+Sans+Pro:wght@200;300;400;600;700&display=swap"
            as="style"
          />
          {/* Not all browsers support "preload" so we use media="print" as backup since it has low priority */}
          {/* see: https://csswizardry.com/2020/05/the-fastest-google-fonts/ */}
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Merriweather:wght@300;400;700&family=Open+Sans:wght@300;400;600;700&family=Source+Sans+Pro:wght@200;300;400;600;700&display=swap"
            media="print"
            onLoad="this.media='all'"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

// `getInitialProps` belongs to `_document` (instead of `_app`),
// it's compatible with server-side generation (SSG).
MyDocument.getInitialProps = async (ctx) => {
  // Resolution order
  //
  // On the server:
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. document.getInitialProps
  // 4. app.render
  // 5. page.render
  // 6. document.render
  //
  // On the server with error:
  // 1. document.getInitialProps
  // 2. app.render
  // 3. page.render
  // 4. document.render
  //
  // On the client
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. app.render
  // 4. page.render

  // Render app and page and get the context of the page with collected side effects.
  const sheets = new ServerStyleSheets();
  const originalRenderPage = ctx.renderPage;

  ctx.renderPage = () =>
    originalRenderPage({
      enhanceApp: (App) => (props) => sheets.collect(<App {...props} />),
    });

  const initialProps = await Document.getInitialProps(ctx);

  return {
    ...initialProps,
    // Styles fragment is rendered after the app and page rendering finish.
    styles: [
      ...React.Children.toArray(initialProps.styles),
      sheets.getStyleElement(),
    ],
  };
};
