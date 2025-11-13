"use client";
import NextLink from "next/link";
import { Grid, Typography, Chip, Container, Box } from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import React, { useState, useEffect } from "react";

import Filter from "./Filter";
import Sort from "./Sort";
import { slugify } from "@/utils/utils";
import { Promise as PromiseItem, PromiseStatus } from "@/payload-types";
import PromiseCard from "../PromiseCard";

type PromiseWithHref = PromiseItem & { href?: string };

interface SortItem {
  name: string;
  slug: string;
  active?: boolean;
}
interface ProjectMeta {
  tags: Array<SortItem>;
}

interface FilterSort {
  label?: string;
  items: SortItem[];
}
interface PromisesProps {
  items: PromiseWithHref[];
  title?: string;
  withFilter?: boolean;
  projectMeta?: ProjectMeta;
  promiseStatuses?: SortItem[];
  sortLabels?: {
    sortByDeadline: SortItem;
    sortByMostRecent: SortItem;
  };
  filterByConfig?: FilterSort;
  sortByConfig?: FilterSort;
  entity?: {
    name: string;
    slug: string;
  };
  backLabel?: string;
}

const filterGridSx = {
  mb: 4,
  mt: 2,
};
const sectionSx = { mb: "2rem" };
const sectionTitleSx = {
  m: "2rem 0rem",
  position: "relative",
  "&::after": {
    borderBottom: "5px solid #000000",
    content: '""',
    display: "block",
    left: 0,
    bottom: 0,
    position: "absolute",
    width: "5rem",
  },
};
const sortItemsSx = {
  alignItems: { xs: "flex-end", lg: "center" },
  display: "flex",
  flexDirection: "row",
  mt: "4rem",
};
const labelSx = { color: "secondary.dark", pr: "0.5rem", pt: "0.4rem" };
const chipsSx = { mt: 3.25 };
const chipSx = { borderRadius: 0, mr: 2 };

function Promises({
  items: itemsProp,
  title,
  withFilter = true,
  projectMeta,
  promiseStatuses = [],
  sortLabels,
  filterByConfig,
  sortByConfig,
  entity,
  backLabel = "Back to",
}: PromisesProps) {
  const sortByDeadline = sortLabels?.sortByDeadline;
  const sortByMostRecent = sortLabels?.sortByMostRecent;
  const filterCategoryItems = projectMeta?.tags ?? [];
  const filterStatusItems = promiseStatuses;
  const [items, setItems] = useState(itemsProp);
  const [selectedFilters, setSelectedFilters] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState(sortByMostRecent?.slug);
  const [filterBy, setFilterBy] = useState("status");

  const getFilter = (slug: string) => {
    const filters = [];
    if (filterBy === "status") {
      filters.push(...(filterStatusItems || []));
    } else {
      filters.push(...(filterCategoryItems || []));
    }
    return filters.find((f) => f.slug === slug);
  };
  const handleFilterClick = (slug: string) => {
    setSelectedFilters((prev) => {
      if (prev.find((f) => f.slug === slug)) {
        return prev;
      }
      return [...prev, getFilter(slug)];
    });
  };
  const handleFilterByClick = (slug: string) => {
    setFilterBy(slug);
    setSelectedFilters([]);
  };
  const handleChipDelete = (slug: string) => () => {
    setSelectedFilters((prev) => prev.filter((f) => f.slug !== slug));
  };
  const handleDeleteAllFilters = () => {
    setSelectedFilters([]);
  };
  const handleSortClicked = (slug: string) => {
    setSortBy(slug);
  };

  useEffect(() => {
    if (withFilter) {
      const hasStatus = (item: PromiseWithHref) => {
        const promiseSlug =
          typeof item?.status === "object" &&
          item?.status !== null &&
          "label" in item.status
            ? slugify(item.status.label ?? "")
            : slugify(item.status ?? "");
        return selectedFilters.some((c) => c.slug === promiseSlug);
      };

      let filteredItems: PromiseWithHref[] = [];
      if (filterBy === "status") {
        filteredItems = itemsProp.filter(hasStatus);
      }

      const hasFilters = selectedFilters?.length;
      setItems(hasFilters ? filteredItems : itemsProp);
    }
  }, [selectedFilters, filterBy, itemsProp, withFilter]);

  useEffect(() => {
    if (withFilter) {
      let sortedItems = items;
      if (sortBy === sortByMostRecent?.slug) {
        sortedItems = items.sort(
          (a, b) => a.createdAt?.localeCompare(b.createdAt ?? "") ?? 0
        );
      } else if (sortBy === sortByDeadline?.slug) {
        sortedItems = items.sort((a, b) => {
          const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bUpdated = b?.updatedAt ? new Date(b.updatedAt).getTime() : 1;
          return bUpdated - aUpdated;
        });
      }
      setItems(sortedItems);
    }
  }, [sortBy, items, sortByDeadline, sortByMostRecent, withFilter]);

  return (
    <Container sx={sectionSx}>
      {entity?.slug ? (
        <Box
          sx={(theme) => ({
            display: "flex",
            justifyContent: { xs: "center", lg: "flex-start" },
            mt: theme.typography.pxToRem(12),
          })}
        >
          <Box
            component={NextLink}
            href={`/${entity.slug}`}
            aria-label={`${backLabel} ${entity.name}`}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              color: "#005DFD",
            }}
          >
            <ArrowBackIosNewRoundedIcon
              sx={(theme) => ({ fontSize: theme.typography.pxToRem(16) })}
            />
            <Typography variant="body2" component="span">
              {backLabel} {entity.name}
            </Typography>
          </Box>
        </Box>
      ) : null}
      <Typography variant="h1" sx={sectionTitleSx}>
        {title || "Promises"}
      </Typography>
      {withFilter && (
        <Grid container justifyContent="space-between" sx={filterGridSx}>
          <Grid
            size={{
              xs: 12,
              lg: 4,
            }}
          >
            <Filter
              label={filterByConfig?.label}
              items={
                filterByConfig?.items.map((item) => ({
                  name: item.name,
                  active: item.slug === filterBy,
                  slug: item.slug,
                })) ?? []
              }
              onClick={handleFilterByClick}
              variant="outlined"
            />
            <Filter
              label=""
              items={
                filterBy === "category"
                  ? filterCategoryItems
                  : filterStatusItems
              }
              onClick={handleFilterClick}
              variant="text"
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              lg: "auto",
            }}
            sx={sortItemsSx}
          >
            <Typography variant="h6" sx={labelSx}>
              {sortByConfig?.label}
            </Typography>
            {sortByConfig?.items.map((item) => (
              <Sort
                key={item.slug}
                active={item.slug === sortBy}
                {...item}
                onClick={handleSortClicked}
              />
            ))}
          </Grid>
          <Grid size={{ xs: 12 }} sx={chipsSx}>
            {selectedFilters?.map((filterItem) => (
              <Chip
                sx={chipSx}
                label={filterItem.name}
                onDelete={handleChipDelete(filterItem.slug)}
                key={filterItem.slug}
              />
            ))}
            {selectedFilters?.length > 0 && (
              <Chip
                sx={chipSx}
                label="Delete All"
                onDelete={handleDeleteAllFilters}
              />
            )}
          </Grid>
        </Grid>
      )}
      <Grid spacing={1} justifyContent="space-between" container>
        {items.map((card: PromiseWithHref) => (
          <Grid
            key={card.id}
            size={{ xs: 12, lg: 4 }}
            sx={{
              pb: {
                xs: 3.75,
                lg: 2,
              },
            }}
          >
            <PromiseCard
              href={card.href}
              title={card.title ?? null}
              image={typeof card.image === "string" ? undefined : card.image}
              description={card.description ?? null}
              status={card.status as PromiseStatus}
              createdAt={card.createdAt}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

export default Promises;
