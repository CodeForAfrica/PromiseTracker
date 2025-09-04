import { Document } from "@/payload-types";

function fullSlugFromParents(
  doc: Document & {
    parent?: Document;
    slug?: string;
    breadcrumbs?: { url: string }[];
  },
): string {
  const { slug, parent } = doc;
  if (!parent) {
    return slug ?? "";
  }
  return `${fullSlugFromParents(parent)}/${slug}`;
}

function fullSlugFromBreadcrumbs({
  breadcrumbs,
}: { breadcrumbs?: { url: string }[] } = {}): string {
  const fullSlug = breadcrumbs?.[breadcrumbs.length - 1]?.url?.slice(1);
  return fullSlug ?? "";
}

function formatPagePath(
  collection: string,
  doc: Document & { breadcrumbs?: { url: string }[] },
): string {
  let pageSlug = fullSlugFromBreadcrumbs(doc) || fullSlugFromParents(doc) || "";
  if (pageSlug === "index") {
    pageSlug = "";
  }
  let prefix = "";
  if (collection) {
    switch (collection) {
      case "pages":
        // Empty prefix for pages
        break;
      default:
        prefix = `/${collection}`;
    }
  }

  return `${prefix}/${pageSlug}`;
}

export default formatPagePath;
