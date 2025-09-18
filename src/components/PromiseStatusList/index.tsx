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
            <Stack spacing={0.75} sx={{ pr: 1, flexGrow: 1 }}>
              <Typography
                variant="subtitle2"
                sx={(theme) => ({
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  backgroundColor: status.color ?? theme.palette.info.main,
                  color:
                    status.textColor ??
                    theme.palette.getContrastText(
                      status.color ?? theme.palette.info.main
                    ),
                  padding: `${theme.typography.pxToRem(4)} ${theme.typography.pxToRem(12)}`,
                  borderRadius: theme.typography.pxToRem(4),
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                })}
              >
                {status.label}
              </Typography>
              <Typography variant="body2" color="primary.dark">
                {status.description}
              </Typography>
            </Stack>
          </Stack>
          {index < statuses.length - 1 ? <Divider flexItem /> : null}
        </Fragment>
      ))}
    </Stack>
  );
};

export default PromiseStatusList;
