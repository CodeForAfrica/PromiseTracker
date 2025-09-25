import { fromUnixTime } from "date-fns";

const BASE_URL = "https://check-api.checkmedia.org/api/graphql";
const DEFAULT_CHANNEL_ID = "1";
const DEFAULT_PAGE_SIZE = 100;
const PUBLISHED_REPORTS_QUERY = `
  query PublishedReports($query: String!) {
    search(query: $query) {
      number_of_results
      item_navigation_offset
      medias {
        edges {
            node {
              id
              status
              dynamic_annotation_report_design {
                data
              }
            }
        }
      }
    }
  }
`;

const createMutationQuery = () => {
  return `
    mutation createProjectMedia($input: CreateProjectMediaInput!) {
      createProjectMedia(input: $input) {
        project_media {
          id
          full_url
          status
        }
      }
    }
  `;
};

type VerificationStatusesResponse = {
  data: {
    team: {
      verification_statuses: {
        statuses: Array<{
          id: string;
          label: string;
          locales?: {
            en?: {
              label?: string;
              description?: string;
            };
          };
          style?: {
            color?: string;
          };
        }>;
      };
    };
  };
};

export interface PromiseStatusItem {
  id: string;
  label: string;
  description: string;
  color: string | null;
}

const createStatusesQuery = (useSlug: boolean) => {
  if (useSlug) {
    return `
      query TeamStatuses($slug: String!) {
        team(slug: $slug) {
          verification_statuses
        }
      }
    `;
  }
  return `
    query TeamStatuses {
      team {
        verification_statuses
      }
    }
  `;
};

export const fetchVerificationStatuses = async ({
  apiKey,
  teamSlug,
  teamId,
}: {
  apiKey: string;
  teamSlug?: string;
  teamId?: string;
}): Promise<PromiseStatusItem[]> => {
  const query = createStatusesQuery(Boolean(teamSlug));
  const variables = teamSlug ? { slug: teamSlug } : undefined;

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Check-Token": apiKey,
      ...(teamId ? { "X-Check-Team": teamId } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = (await response.json()) as VerificationStatusesResponse;

  const statuses = json?.data?.team?.verification_statuses?.statuses ?? [];

  return statuses.map((s) => {
    const enLabel = s?.locales?.en?.label ?? s?.label ?? "";
    const enDescription = s?.locales?.en?.description ?? "";
    const color = s?.style?.color ?? null;
    return {
      id: s.id,
      label: enLabel,
      description: enDescription,
      color,
    } satisfies PromiseStatusItem;
  });
};

export interface FactCheck {
  title: string;
  summary?: string;
  url: string;
  language: string;
  publish_report: boolean;
}

export interface CreateProjectMediaInput {
  media_type:
    | "Claim"
    | "Link"
    | "UploadedImage"
    | "UploadedVideo"
    | "UploadedAudio"
    | "Blank";
  quote: string;
  channel: { main: number };
  set_tags?: string[];
  set_status?: string;
  set_claim_description?: string;
  set_fact_check?: FactCheck;
}

export interface CreateProjectMediaResponse {
  data: {
    createProjectMedia: {
      project_media: {
        id: string;
        full_url: string;
        status: string;
      };
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export type PublishedReportsResponse = {
  data?: {
    search?: {
      number_of_results?: number;
      item_navigation_offset?: number;
      medias?: {
        edges?: Array<{
          node?: {
            id?: string | null;
            status?: string | null;
            dynamic_annotation_report_design?: {
              data?: {
                options?: Record<string, unknown> | null;
                state?: string | null;
                last_published?: string | number | null;
              } | null;
            } | null;
          } | null;
        }>;
      } | null;
    } | null;
  };
};

export interface PublishedReport {
  meedanId: string;
  introduction: string | null;
  themeColor: string | null;
  statusLabel: string | null;
  status: string | null;
  image: string | null;
  title: string | null;
  headline: string | null;
  text: string | null;
  description: string | null;
  publishedArticleUrl: string | null;
  useVisualCard: boolean;
  state: string | null;
  lastPublished: string | null;
}

export const toNullableString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

export const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "") {
      return false;
    }
    return true;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return false;
};

export const toIsoTimestamp = (value: unknown): string | null => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value.trim())
      : null;

  if (numericValue === null || Number.isNaN(numericValue)) {
    return null;
  }

  const seconds = numericValue > 1e12 ? numericValue / 1000 : numericValue;
  return fromUnixTime(seconds).toISOString();
};

export const mapPublishedReports = (
  payload: PublishedReportsResponse
): PublishedReport[] => {
  const edges =
    payload?.data?.search?.medias?.edges?.filter(Boolean) ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter((node): node is NonNullable<typeof node> => Boolean(node))
    .map((node) => {
      const meedanId = toNullableString(node.id);
      const data = node.dynamic_annotation_report_design?.data ?? undefined;
      const options = (data?.options ?? {}) as Record<string, unknown>;
      const status = toNullableString(node.status ?? null);

      if (!meedanId) {
        return null;
      }

      return {
        meedanId,
        status,
        introduction: toNullableString(options["introduction"]),
        themeColor: toNullableString(options["theme_color"]),
        statusLabel: toNullableString(options["status_label"]),
        image: toNullableString(options["image"]),
        title: toNullableString(options["title"]),
        headline: toNullableString(options["headline"]),
        text: toNullableString(options["text"]),
        description: toNullableString(options["description"]),
        publishedArticleUrl: toNullableString(options["published_article_url"]),
        useVisualCard: toBoolean(options["use_visual_card"]),
        state: toNullableString(data?.state ?? null),
        lastPublished: toIsoTimestamp(data?.last_published ?? null),
      } satisfies PublishedReport;
    })
    .filter((report): report is PublishedReport => report !== null);
};

export const fetchPublishedReports = async ({
  apiKey,
  teamId,
}: {
  apiKey: string;
  teamId: string;
}): Promise<PublishedReport[]> => {
  const payload = {
    query: PUBLISHED_REPORTS_QUERY,
    variables: {
      query: JSON.stringify({ report_status: ["published"] }),
    },
  };

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Check-Token": apiKey,
      "X-Check-Team": teamId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = (await response.json()) as PublishedReportsResponse;

  return mapPublishedReports(json);
};

export const postRequest = async ({
  apiKey,
  teamId,
  data,
}: {
  apiKey: string;
  teamId: string;
  data: CreateProjectMediaInput;
}): Promise<CreateProjectMediaResponse> => {
  const query = createMutationQuery();

  const requestBody = {
    query,
    variables: {
      input: data,
    },
  };

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Check-Token": apiKey,
        "X-Check-Team": teamId,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: CreateProjectMediaResponse = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(
        `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`
      );
    }

    return result;
  } catch (error) {
    console.error("Error making request to CheckMedia:", error);
    throw error;
  }
};

export const createFactCheckClaim = async ({
  apiKey,
  teamId,
  quote,
  tags = [],
  claimDescription,
  factCheck,
}: {
  apiKey: string;
  teamId: string;
  quote: string;
  tags?: string[];
  claimDescription: string;
  factCheck: FactCheck;
}) => {
  const input: CreateProjectMediaInput = {
    media_type: "Claim",
    quote,
    channel: { main: 1 },
    set_tags: tags,
    set_status: "undetermined",
    set_claim_description: claimDescription,
    set_fact_check: factCheck,
  };

  return await postRequest({ apiKey, teamId, data: input });
};

const searchProjectMediaStatusesQuery = () => `
  query ProjectMediaSearch($query: String!) {
    search(query: $query) {
      number_of_results
      medias {
        edges {
          node {
            id
            status
          }
        }
      }
    }
  }
`;

type ProjectMediaSearchResponse = {
  data?: {
    search?: {
      number_of_results?: number | null;
      medias?: {
        edges?: Array<{
          node?: {
            id?: string | null;
            status?: string | null;
          } | null;
        }> | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

export interface ProjectMediaStatusItem {
  checkMediaId: string;
  status: string;
}

export const fetchProjectMediaStatuses = async ({
  apiKey,
  teamId,
  channelId = DEFAULT_CHANNEL_ID,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  apiKey: string;
  teamId: string;
  channelId?: string;
  pageSize?: number;
}): Promise<ProjectMediaStatusItem[]> => {
  const query = searchProjectMediaStatusesQuery();
  const results: ProjectMediaStatusItem[] = [];
  let offset = 0;
  let fetched = 0;
  let total = Number.POSITIVE_INFINITY;

  while (fetched < total) {
    const searchPayload = {
      esoffset: offset,
      eslimit: pageSize,
      channels: [channelId],
    };

    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Check-Token": apiKey,
        "X-Check-Team": teamId,
      },
      body: JSON.stringify({
        query,
        variables: { query: JSON.stringify(searchPayload) },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const payload = (await response.json()) as ProjectMediaSearchResponse;

    if (payload.errors && payload.errors.length > 0) {
      const message = payload.errors
        .map((error) => error?.message ?? "Unknown error")
        .join("; ");
      throw new Error(`GraphQL errors: ${message}`);
    }

    const search = payload?.data?.search;
    total = search?.number_of_results ?? 0;
    const edges = search?.medias?.edges ?? [];

    if (edges.length === 0) {
      break;
    }

    for (const edge of edges) {
      const checkMediaId = edge?.node?.id;
      const status = edge?.node?.status;

      const trimmedCheckMediaId = checkMediaId?.trim();
      const trimmedStatus = status?.trim();

      if (trimmedCheckMediaId && trimmedStatus) {
        results.push({
          checkMediaId: trimmedCheckMediaId,
          status: trimmedStatus,
        });
      }
    }

    fetched += edges.length;
    offset += pageSize;
  }

  return results;
};
