"use client";

import React, { useMemo } from "react";
import type { TextFieldClientProps, TextFieldValidation } from "payload";
import { PasswordField, useFormFields } from "@payloadcms/ui";

const getMaskedApiKeyPreview = (rawValue: unknown) => {
  if (typeof rawValue !== "string") {
    return "";
  }

  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const toPasswordValidation = (
  validate: TextFieldValidation | undefined,
  required: boolean | undefined,
) =>
  ((value: unknown, options: unknown) => {
    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim().length === 0);

    if (required && isEmpty) {
      return "This field is required.";
    }

    if (typeof validate === "function") {
      return validate(value as string | null | undefined, options as never);
    }

    return true;
  }) as never;

export const MaskedApiKeyField: React.FC<TextFieldClientProps> = (props) => {
  const fieldPath = props.path || props.field.name;
  const fieldValue = useFormFields(
    ([fields]) => fields[fieldPath]?.value as string | undefined,
  );

  const maskedPreview = useMemo(
    () => getMaskedApiKeyPreview(fieldValue),
    [fieldValue],
  );

  const staticDescription =
    typeof props.field.admin?.description === "string"
      ? props.field.admin.description
      : "";
  const previewDescription = maskedPreview
    ? `Saved value preview: ${maskedPreview}`
    : "Value preview appears after you enter an API key.";
  const combinedDescription = `${staticDescription} ${previewDescription}`.trim();

  const fieldWithMaskedDescription = useMemo(
    () => ({
      ...props.field,
      admin: {
        ...props.field.admin,
        description: combinedDescription,
      },
    }),
    [props.field, combinedDescription],
  );

  return (
    <PasswordField
      autoComplete="off"
      field={fieldWithMaskedDescription}
      path={fieldPath}
      validate={toPasswordValidation(props.validate, props.field.required)}
    />
  );
};
