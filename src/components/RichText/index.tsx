import { type DefaultTypedEditorState } from "@payloadcms/richtext-lexical";
import { RichText as PayloadRichText } from "@payloadcms/richtext-lexical/react";
import React from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

export type RichTextProps = {
  data: DefaultTypedEditorState;
  className?: string;
  component?: React.ElementType;
  sx?: SxProps<Theme>;
};

export const RichText = ({
  data,
  className,
  component = "div",
  sx,
}: RichTextProps) => {
  return (
    <Box
      component={component}
      className={className}
      sx={(theme: Theme) => ({
        color: "inherit",
        "& h1, & h2, & h3, & h4, & h5, & h6": {
          margin: 0,
          marginBottom: theme.typography.pxToRem(12),
        },
        "& p": {
          margin: 0,
          marginBottom: theme.typography.pxToRem(16),
        },
        "& a": {
          color: theme.palette.primary.main,
          textDecoration: "underline",
          "&:hover": { textDecoration: "none" },
        },
        "& ul, & ol": {
          marginTop: theme.typography.pxToRem(8),
          marginBottom: theme.typography.pxToRem(16),
          paddingLeft: theme.typography.pxToRem(24),
        },
        "& li": {
          marginBottom: theme.typography.pxToRem(6),
        },
        "& blockquote": {
          margin: 0,
          marginLeft: theme.typography.pxToRem(8),
          paddingLeft: theme.typography.pxToRem(12),
          borderLeft: `4px solid ${theme.palette.divider}`,
        },
        "& hr": {
          border: 0,
          height: 1,
          backgroundColor: theme.palette.divider,
          margin: `${theme.typography.pxToRem(24)} 0`,
        },
        ...((typeof sx === "function" ? sx(theme) : sx) as object),
      })}
    >
      <PayloadRichText data={data} />
    </Box>
  );
};
