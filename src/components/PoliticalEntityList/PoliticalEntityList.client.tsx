"use client";

import React, { useMemo, useState } from "react";
import NextLink from "next/link";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";

import {
  DesktopInfoStatusPopover,
  MobileInfoStatusPopover,
} from "@/components/PromiseStatusInfo";
import type { PromiseStatusListProps } from "@/components/PromiseStatusList";

export type PoliticalEntityListClientProps = {
  statusGroups: {
    id: string;
    title: string;
    color: string;
    statusIds: string[];
  }[];
  filterOptions: {
    key: string;
    label: string;
    count: number;
  }[];
  items: {
    id: string;
    href: string;
    name: string;
    position: string;
    region: string | null;
    initials: string;
    avatar: {
      url: string | null;
      alt: string;
    };
    totalPromises: number;
    statusCounts: Record<string, number>;
    filterKey: string;
  }[];
  statusDefinitions: PromiseStatusListProps["statuses"];
  statusInfoTitle?: string;
};

export const PoliticalEntityListClient = ({
  statusGroups,
  filterOptions,
  items,
  statusDefinitions,
  statusInfoTitle = "Promise status definitions",
}: PoliticalEntityListClientProps) => {
  const [activeFilter, setActiveFilter] = useState(
    filterOptions[0]?.key ?? "all",
  );

  const visibleItems = useMemo(() => {
    if (activeFilter === "all") {
      return items;
    }

    return items.filter((item) => item.filterKey === activeFilter);
  }, [activeFilter, items]);

  const handleFilterClick = (key: string) => {
    setActiveFilter(key);
  };

  const hasStatusDefinitions = statusDefinitions.length > 0;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction="row"
        spacing={{ xs: 2, md: 3 }}
        alignItems="center"
        justifyContent="space-between"
        sx={{ flexWrap: { xs: "wrap", md: "nowrap" } }}
      >
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
          sx={{ flexGrow: 1 }}
        >
          {filterOptions.map((option) => {
            const isActive = option.key === activeFilter;
            return (
              <Chip
                key={option.key}
                label={`${option.label} ${option.count}`}
                onClick={() => handleFilterClick(option.key)}
                clickable
                variant={isActive ? "filled" : "outlined"}
                sx={{
                  borderRadius: 999,
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? "text.primary" : "transparent",
                  color: isActive ? "common.white" : "text.primary",
                  borderColor: isActive ? "text.primary" : "divider",
                  "& .MuiChip-label": {
                    px: 1.5,
                  },
                }}
              />
            );
          })}
        </Stack>
        {hasStatusDefinitions ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              flexShrink: 0,
              justifyContent: "flex-end",
              marginLeft: "0 !important",
            }}
          >
            <Box sx={{ display: { xs: "none", md: "flex" } }}>
              <DesktopInfoStatusPopover
                title={statusInfoTitle}
                statuses={statusDefinitions}
              />
            </Box>
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <MobileInfoStatusPopover
                title={statusInfoTitle}
                statuses={statusDefinitions}
              />
            </Box>
          </Stack>
        ) : null}
      </Stack>

      <Divider />

      {visibleItems.length === 0 ? (
        <Box sx={{ py: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No political entities match this filter yet.
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {visibleItems.map((item, index) => {
            const groupSummaries = statusGroups
              .map((group) => {
                const count = group.statusIds.reduce(
                  (total, statusId) =>
                    total + (item.statusCounts[statusId] ?? 0),
                  0,
                );

                if (count === 0) {
                  return null;
                }

                return {
                  id: group.id,
                  title: group.title,
                  color: group.color,
                  count,
                };
              })
              .filter(
                (
                  value,
                ): value is {
                  id: string;
                  title: string;
                  color: string;
                  count: number;
                } => Boolean(value),
              );

            return (
              <React.Fragment key={item.id}>
                <ListItem disableGutters sx={{ alignItems: "stretch", py: 0 }}>
                  <ListItemButton
                    component={NextLink}
                    href={item.href}
                    sx={{
                      borderRadius: 2,
                      px: { xs: 1.5, md: 2 },
                      py: { xs: 1.5, md: 1.5 },
                      "&:hover": {
                        backgroundColor: "action.hover",
                      },
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={{ xs: 1.5, md: 2 }}
                      alignItems={{ xs: "flex-start", md: "center" }}
                      sx={{ width: "100%" }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{ minWidth: 0, flexGrow: 1 }}
                      >
                        <Avatar
                          src={item.avatar.url ?? undefined}
                          alt={item.avatar.alt}
                          sx={{ width: 52, height: 52 }}
                        >
                          {item.initials || "?"}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 700,
                              lineHeight: 1.2,
                              textTransform: "capitalize",
                            }}
                          >
                            {item.name}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.primary" }}
                          >
                            {item.position}
                            {item.region ? ` · ${item.region}` : ""}
                          </Typography>
                        </Box>
                      </Stack>
                      {groupSummaries.length > 0 ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                          justifyContent={{ xs: "flex-start", md: "flex-end" }}
                          sx={{
                            flexGrow: { md: 1 },
                            minWidth: 0,
                          }}
                        >
                          {groupSummaries.map((group, groupIndex) => (
                            <React.Fragment key={group.id}>
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  color: group.color || "text.primary",
                                }}
                              >
                                {group.title}: {group.count}
                              </Typography>
                              {groupIndex < groupSummaries.length - 1 ? (
                                <Typography
                                  component="span"
                                  variant="body2"
                                  sx={{ color: "text.disabled" }}
                                >
                                  |
                                </Typography>
                              ) : null}
                            </React.Fragment>
                          ))}
                        </Stack>
                      ) : null}
                      <Chip
                        label={`${item.totalPromises} promise${
                          item.totalPromises === 1 ? "" : "s"
                        }`}
                        sx={{
                          borderRadius: 999,
                          fontWeight: 600,
                          backgroundColor:
                            item.totalPromises > 0
                              ? "text.primary"
                              : "transparent",
                          color:
                            item.totalPromises > 0
                              ? "common.white"
                              : "text.primary",
                          borderColor:
                            item.totalPromises > 0 ? "transparent" : "divider",
                          borderWidth: 1,
                          borderStyle: "solid",
                          "& .MuiChip-label": {
                            px: 1.5,
                            fontFamily: (theme) =>
                              theme.typography.body2.fontFamily,
                            fontSize: (theme) =>
                              theme.typography.body2.fontSize,
                            fontWeight: 600,
                            textTransform: "capitalize",
                          },
                        }}
                      />
                    </Stack>
                  </ListItemButton>
                </ListItem>
                {index < visibleItems.length - 1 ? (
                  <Divider sx={{ my: 0.5 }} />
                ) : null}
              </React.Fragment>
            );
          })}
        </List>
      )}
    </Stack>
  );
};
