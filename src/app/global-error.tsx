"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- A global layout failure needs full-document navigation to recover safely. */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Page error | PromiseTracker</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; }
          html, body { margin: 0; min-height: 100%; }
          body {
            color: #000;
            background: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          ::selection { color: #fff; background: #005dfd; }
          .error-shell { min-height: 100vh; display: flex; overflow: hidden; }
          .error-container {
            width: min(1080px, calc(100% - 32px));
            min-height: 100vh;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
          }
          .error-header { padding: 32px 0; border-bottom: 1px solid #000; }
          .error-brand {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            color: inherit;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.02em;
            text-decoration: none;
          }
          .error-track { width: 42px; height: 14px; position: relative; }
          .error-track::before {
            content: "";
            position: absolute;
            top: 6px;
            right: 0;
            left: 0;
            border-top: 2px solid #000;
          }
          .error-track::after {
            content: "";
            position: absolute;
            top: 2px;
            right: 0;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #005dfd;
          }
          .error-content {
            flex: 1;
            display: grid;
            grid-template-columns: minmax(0, 4fr) minmax(0, 6fr);
            align-items: center;
            gap: 80px;
            padding: 80px 0;
          }
          .error-code {
            margin: 0;
            font-size: clamp(4.5rem, 12vw, 6rem);
            font-weight: 700;
            line-height: 0.9;
            letter-spacing: -0.04em;
            font-variant-numeric: tabular-nums;
          }
          .error-line { width: min(100%, 280px); height: 12px; margin-top: 32px; position: relative; }
          .error-line::before {
            content: "";
            position: absolute;
            top: 5px;
            right: 0;
            left: 0;
            border-top: 2px solid #ebebeb;
          }
          .error-line::after {
            content: "";
            position: absolute;
            top: 1px;
            left: 65%;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ffb322;
            box-shadow: 0 0 0 5px #fff;
          }
          .error-copy { max-width: 640px; }
          .error-title {
            max-width: 12ch;
            margin: 0;
            font-size: clamp(2.25rem, 5vw, 3.5rem);
            font-weight: 700;
            line-height: 1.08;
            letter-spacing: -0.035em;
          }
          .error-description {
            max-width: 62ch;
            margin: 24px 0 0;
            color: #4f4f4f;
            font-size: 18px;
            line-height: 1.65;
          }
          .error-actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 32px; }
          .error-button {
            min-height: 50px;
            padding: 0 32px;
            border: 2px solid #000;
            border-radius: 0;
            font: inherit;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .error-button-primary { color: #fff; background: #000; }
          .error-button-secondary { color: #000; background: #fff; }
          .error-brand:focus-visible, .error-button:focus-visible {
            outline: 3px solid #005dfd;
            outline-offset: 3px;
          }
          .error-button:hover { color: #fff; border-color: #005dfd; background: #005dfd; }
          @media (max-width: 767px) {
            .error-header { padding: 24px 0; }
            .error-content { grid-template-columns: 1fr; align-content: center; gap: 32px; padding: 48px 0; }
            .error-description { font-size: 16px; }
            .error-actions { flex-direction: column; }
            .error-button { width: 100%; }
          }
          @media (prefers-reduced-motion: no-preference) {
            .error-button { transition: color 160ms ease-out, background-color 160ms ease-out, border-color 160ms ease-out; }
          }
        `}</style>
      </head>
      <body>
        <main className="error-shell" role="alert">
          <div className="error-container">
            <header className="error-header">
              <a
                className="error-brand"
                href="/"
                aria-label="PromiseTracker home"
              >
                <span className="error-track" aria-hidden="true" />
                <span>Promise Tracker</span>
              </a>
            </header>
            <div className="error-content">
              <div aria-hidden="true">
                <p className="error-code">500</p>
                <div className="error-line" />
              </div>
              <div className="error-copy">
                <h1 className="error-title">This page could not load</h1>
                <p className="error-description">
                  The problem may be temporary. Try loading the page again, or
                  return home and continue from there.
                </p>
                <div className="error-actions">
                  <button
                    className="error-button error-button-primary"
                    type="button"
                    onClick={reset}
                  >
                    Try again
                  </button>
                  <a className="error-button error-button-secondary" href="/">
                    Return home
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
