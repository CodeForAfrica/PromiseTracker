export type PromiseUpdateQuestionType = "text" | "textarea" | "upload";

export type PromiseUpdateQuestion = {
  id: string;
  label: string;
  description?: string | null;
  required?: boolean | null;
  type: PromiseUpdateQuestionType;
};

export type PromiseUpdateContent = {
  title: string;
  description: string;
  submitButtonText: string;
  questions: PromiseUpdateQuestion[];
  uploadDropLabel: string;
  uploadBrowseLabel: string;
};
