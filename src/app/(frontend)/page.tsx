import PageTemplate from "./[...slugs]/page";

// Multi-tenant, subdomain-resolved page — never statically prerendered.
export const dynamic = "force-dynamic";

export default PageTemplate;
