"use client";

import { Fragment } from "react";
import { Divider, Stack, Typography } from "@mui/material";

export type PromiseStatusListProps = {
  statuses: {
    id: string;
    label: string;
    description: string;
    color?: string | null;
    textColor?: string | null;
  }[];
};

export const PromiseStatusList = ({ statuses }: PromiseStatusListProps) => {
  if (!statuses.length) {
    return null;
  }

  return (
    <Stack spacing={1.5} sx={{ width: "100%" }}>
      {statuses.map((status, index) => (
        <Fragment key={status.id}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Stack
              sx={(theme) => ({
                width: theme.typography.pxToRem(14),
                height: theme.typography.pxToRem(14),
                borderRadius: "50%",
                backgroundColor: status.color ?? theme.palette.info.main,
                flexShrink: 0,
                border: `1px solid ${theme.palette.divider}`,
                mt: theme.typography.pxToRem(4),
              })}
            />
            <Stack spacing={0.75} sx={{ pr: 1 }}>
              <Typography
                variant="subtitle2"
                sx={(theme) => ({
                  fontWeight: 600,
                  color: status.textColor ?? theme.palette.text.primary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                })}
              >
                {status.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {status.description}
              </Typography>
            </Stack>
          </Stack>
          <Divider flexItem sx={{ opacity: index === statuses.length - 1 ? 0.5 : 1 }} />
        </Fragment>
      ))}
    </Stack>
  );
};

export default PromiseStatusList;
