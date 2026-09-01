"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import ErrorPage from "@/components/ErrorPage";

export default function FrontendError({
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
    <ErrorPage
      code="500"
      title="This page could not load"
      description="The problem may be temporary. Try loading the page again, or return home and continue from there."
      retry={reset}
    />
  );
}
