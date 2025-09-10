import React from "react";

import type { Page } from "@/payload-types";
import { Link, SxProps, Theme } from "@mui/material";

type CMSLinkType = {
  children?: React.ReactNode;
  label: string;
  newTab?: boolean | null;
  reference?: {
    relationTo: "pages";
    value: Page | string | number;
  } | null;
  type?: "custom" | "reference" | null;
  url?: string | null;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  sx: SxProps<Theme>;
};

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const { type, children, label, newTab = false, reference, url, sx } = props;

  const getHref = () => {
    if (
      type === "reference" &&
      typeof reference?.value === "object" &&
      reference.value.slug
    ) {
      switch (reference.relationTo) {
        case "pages":
          return `/${reference.value.slug}`;
        default:
          return "";
      }
    }
    return url || "";
  };

  const href = getHref();

  if (!href) return null;

  const newTabProps = newTab
    ? { rel: "noopener noreferrer", target: "_blank" }
    : {};

  return (
    <Link href={href} {...newTabProps} sx={sx}>
      {label && label}
      {children && children}
    </Link>
  );
};
