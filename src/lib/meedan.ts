const BASE_URL = "https://check-api.checkmedia.org/api/graphql";
const DEFAULT_CHANNEL_ID = "1";
const DEFAULT_PAGE_SIZE = 100;
const PUBLISHED_REPORTS_QUERY = `
  query PublishedReports($query: String!) {
    search(query: $query) {
      number_of_results
      medias {
        edges {
          node {
            id
            full_url
            title
            description
            report_status
            status
            annotations(annotation_type: "task") {
              edges {
                node {
                  ... on Task {
                    type
                    slug
                    label
                    description
                    fieldset
                    first_response_value
                    first_response {
                      content
                      file_data
                    }
                  }
                }
              }
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

type PublishedReportAnnotation = {
  type?: string | null;
  slug?: string | null;
  label?: string | null;
  description?: string | null;
  fieldset?: string | null;
  first_response_value?: unknown;
  first_response?: {
    content?: unknown;
    file_data?: {
      file_urls?: unknown;
    } | null;
  } | null;
};

export type PublishedReportsResponse = {
  data?: {
    search?: {
      number_of_results?: number;
      medias?: {
        edges?: Array<{
          node?: {
            id?: string | null;
            full_url?: string | null;
            title?: string | null;
            description?: string | null;
            report_status?: string | null;
            status?: string | null;
            annotations?: {
              edges?: Array<{
                node?: PublishedReportAnnotation | null;
              }> | null;
            } | null;
          } | null;
        }>;
      } | null;
    } | null;
  };
};

export interface PublishedReport {
  meedanId: string;
  status: string | null;
  image: string | null;
  title: string | null;
  description: string | null;
  url: string | null;
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

const extractAnnotationValue = (value: unknown, depth = 0): string | null => {
  if (depth > 3 || value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractAnnotationValue(item, depth + 1);
      if (extracted) {
        return extracted;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    const candidateKeys = [
      "value",
      "label",
      "name",
      "text",
      "title",
      "selected",
      "selected_option",
      "slug",
      "id",
    ];

    for (const key of candidateKeys) {
      if (key in (value as Record<string, unknown>)) {
        const extracted = extractAnnotationValue(
          (value as Record<string, unknown>)[key],
          depth + 1
        );
        if (extracted) {
          return extracted;
        }
      }
    }
  }

  return null;
};

export const mapPublishedReports = (
  payload: PublishedReportsResponse
): PublishedReport[] => {
  const edges = payload?.data?.search?.medias?.edges?.filter(Boolean) ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter((node): node is NonNullable<typeof node> => Boolean(node))
    .map((node) => {
      const meedanId = toNullableString(node.id);
      const status = toNullableString(node.status ?? null);
      const url = toNullableString(node.full_url ?? null);
      const annotations = node.annotations?.edges ?? [];

      const findAnnotationValue = (...slugs: string[]): string | null => {
        for (const slug of slugs) {
          const normalisedSlug = slug.trim().toLowerCase();
          for (const edgeItem of annotations) {
            const nodeData = edgeItem?.node;
            const annotationSlug = toNullableString(nodeData?.slug);
            if (!annotationSlug) {
              continue;
            }
            if (annotationSlug.trim().toLowerCase() !== normalisedSlug) {
              continue;
            }

            const fileUrls =
              nodeData?.first_response?.file_data?.file_urls;

            if (Array.isArray(fileUrls)) {
              for (const value of fileUrls) {
                const normalisedUrl = toNullableString(value);
                if (normalisedUrl) {
                  return normalisedUrl;
                }
              }
            }

            const extractedValue =
              extractAnnotationValue(nodeData?.first_response_value) ??
              extractAnnotationValue(nodeData?.first_response?.content);

            if (extractedValue) {
              return extractedValue;
            }
          }
        }

        return null;
      };

      const image = findAnnotationValue(
        "what_is_the_image_related_to_the_promise",
        "image"
      );

      if (!meedanId) {
        return null;
      }

      return {
        meedanId,
        status,
        image,
        title: toNullableString(node.title ?? null),
        description: toNullableString(node.description ?? null),
        url,
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
