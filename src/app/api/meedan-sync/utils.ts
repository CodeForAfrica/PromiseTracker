type MeedanFile = {
  url?: unknown;
};

type MeedanField = {
  value?: unknown;
};

type ReportDesignOptions = {
  title?: unknown;
  description?: unknown;
  text?: unknown;
  headline?: unknown;
  published_article_url?: unknown;
  deadline?: unknown;
};

export type ReportDesignData = {
  options?: ReportDesignOptions | null;
  state?: unknown;
  fields?: MeedanField[];
};

export type MeedanWebhookPayload = {
  data?: {
    id?: unknown;
  };
  object?: {
    annotation_type?: string | null;
    annotated_type?: string | null;
    annotated_id?: unknown;
    file?: MeedanFile[];
    data?: ReportDesignData | null;
  };
};

export const normaliseString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const createGraphqlIdFromAnnotation = (
  typeValue: unknown,
  idValue: unknown
): string | null => {
  const type = normaliseString(typeValue);
  const id = normaliseString(idValue);

  if (!type || !id) {
    return null;
  }

  try {
    return Buffer.from(`${type}/${id}`, "utf8").toString("base64");
  } catch (error) {
    console.warn("meedan-sync:: Failed to encode GraphQL ID", {
      type,
      id,
      error,
    });
    return null;
  }
};

const uniqueStrings = (values: Array<string | null>): string[] => {
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (result.includes(value)) continue;
    result.push(value);
  }
  return result;
};

export const buildMeedanIdCandidates = (
  payload: MeedanWebhookPayload,
  primaryId?: string | null
): string[] => {
  const annotationId = primaryId ?? normaliseString(payload?.data?.id);
  const annotatedGlobalId = createGraphqlIdFromAnnotation(
    payload?.object?.annotated_type,
    payload?.object?.annotated_id
  );
  const annotatedDbId = normaliseString(payload?.object?.annotated_id);

  return uniqueStrings([annotationId, annotatedGlobalId, annotatedDbId]);
};
