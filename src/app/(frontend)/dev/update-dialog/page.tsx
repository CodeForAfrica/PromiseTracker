import { notFound } from "next/navigation";

import UpdateDialogPreview from "./UpdateDialogPreview";

/**
 * Development-only harness page used by the Playwright accessibility
 * and embed-rejection tests (tests/e2e/security.e2e.spec.ts). Never
 * available in production builds.
 */
export default function UpdateDialogPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <UpdateDialogPreview />;
}
