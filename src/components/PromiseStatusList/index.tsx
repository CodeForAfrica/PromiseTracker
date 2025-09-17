"use client";

import { Box, Stack, Typography, type SxProps, type Theme } from "@mui/material";

export type PromiseStatusListItem = {
  title: string;
  description: string;
  color?: string | null;
};

export type PromiseStatusListProps = {
  items: PromiseStatusListItem[];
  itemSx?: SxProps<Theme>;
  descriptionSx?: SxProps<Theme>;
};

const indicatorSx: SxProps<Theme> = (theme) => ({
  width: theme.typography.pxToRem(12),
  height: theme.typography.pxToRem(12),
  borderRadius: "50%",
  flexShrink: 0,
});

export const PromiseStatusList = ({
  items,
  itemSx,
  descriptionSx,
}: PromiseStatusListProps) => {
  if (!items.length) {
    return null;
  }

  return (
    <Stack direction="column" spacing={1.5}>
      {items.map((item) => (
        <Stack
          key={item.title}
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          sx={itemSx}
        >
          <Box sx={{ ...indicatorSx, bgcolor: item.color ?? "info.main" }} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {item.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", ...descriptionSx }}
            >
              {item.description}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

export default PromiseStatusList;
