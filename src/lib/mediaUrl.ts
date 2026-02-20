export const normalizeMediaSourceUrl = (value?: string | null): string => {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return trimmed;
  }
};

export const addMediaSourceLookup = (
  lookup: Map<string, string>,
  mediaId: string,
  ...urls: Array<string | null | undefined>
) => {
  if (!mediaId) {
    return;
  }

  for (const candidate of urls) {
    const normalized = normalizeMediaSourceUrl(candidate);
    if (!normalized || lookup.has(normalized)) {
      continue;
    }

    lookup.set(normalized, mediaId);
  }
};

export const getMediaIdFromLookup = (
  lookup: Map<string, string>,
  sourceUrl?: string | null,
): string | null => {
  const normalized = normalizeMediaSourceUrl(sourceUrl);
  if (!normalized) {
    return null;
  }

  return lookup.get(normalized) ?? null;
};
