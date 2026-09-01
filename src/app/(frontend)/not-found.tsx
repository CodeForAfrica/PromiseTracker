import type { Metadata } from "next";

import ErrorPage from "@/components/ErrorPage";

export const metadata: Metadata = {
  title: "Page not found | PromiseTracker",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="This page isn't on the tracker"
      description="The address may be incorrect, or the page may have moved. Return home to continue browsing tracked promises."
    />
  );
}
