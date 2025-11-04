import { getGlobalPayload } from "@/lib/payload";
import type {
  PromiseUpdateContent,
  PromiseUpdateQuestion,
} from "@/types/promiseUpdates";

const payload = await getGlobalPayload();

const isValidType = (
  value: unknown
): value is PromiseUpdateQuestion["type"] => {
  return value === "text" || value === "textarea" || value === "upload";
};

const getLocalizedString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    for (const candidate of Object.values(value as Record<string, unknown>)) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return "";
};

export const getPromiseUpdateContent =
  async (): Promise<PromiseUpdateContent | null> => {
    try {
      const doc = await payload.findGlobal({
        slug: "promise-updates",
      });

      const docData = doc;
      const rawQuestions = Array.isArray(docData.questions)
        ? docData.questions
        : [];

      const questions = rawQuestions
        .map((raw, index): PromiseUpdateQuestion | null => {
          if (!raw || typeof raw !== "object") {
            return null;
          }

          const row = raw as Record<string, unknown>;
          const label = getLocalizedString(row["question"]);
          if (!label) {
            return null;
          }

          const typeValue = row["type"];
          const type = isValidType(typeValue) ? typeValue : "text";

          const description = getLocalizedString(row["description"]);

          const idValue = row["id"];
          const id =
            typeof idValue === "string" && idValue
              ? idValue
              : `promise-update-question-${index}`;

          return {
            id,
            label,
            description: description || null,
            required: Boolean(row["required"]),
            type,
          };
        })
        .filter(
          (
            question: PromiseUpdateQuestion | null
          ): question is PromiseUpdateQuestion => Boolean(question)
        );

      const title = getLocalizedString(docData["title"]);
      const description = getLocalizedString(docData["description"]);
      const submitButtonText = getLocalizedString(docData["submitButtonText"]);
      const uploadDropLabel = getLocalizedString(docData["uploadDropLabel"]);
      const uploadBrowseLabel = getLocalizedString(
        docData["uploadBrowseLabel"]
      );

      return {
        title,
        description,
        submitButtonText,
        uploadDropLabel,
        uploadBrowseLabel,
        questions,
      };
    } catch (error) {
      payload.logger.error({
        message:
          "getPromiseUpdateContent:: Failed to load promise update content",
        error,
      });
      return null;
    }
  };
