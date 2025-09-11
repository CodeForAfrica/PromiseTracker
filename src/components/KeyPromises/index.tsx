"use client";

import { KeyPromises as KeyPromisesProps } from "@/payload-types";
import { Box, Container, IconButton, MobileStepper, Typography, useMediaQuery } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { useEffect, useMemo, useRef, useState } from "react";
import PromiseTimeline from "@/components/PromiseTimeline";
import CtAButton from "@/components/CtAButton";

type Status = {
  color: string;
  label?: string;
};

type StatusHistoryItem = Status & { date: string };

type PromiseEvent = {
  title: string;
  year: number;
  color?: string;
  textColor?: string;
};

type Item = {
  title: string;
  description?: string;
  href?: string;
  image?: string;
  status: Status;
  statusHistory: StatusHistoryItem[];
  events?: PromiseEvent[];
};

// Temporary placeholder data until CMS fields are available
const placeholderItems: Item[] = [
  {
    title: "Increase Government Transparency",
    description:
      "Publish quarterly budget reports and open datasets to the public.",
    href: "/promises/transparency",
    status: { color: "#2e7d32", label: "On Track" },
    statusHistory: [
      { color: "#9ccc65", date: "2022-09-10" },
      { color: "#66bb6a", date: "2023-06-01" },
      { color: "#2e7d32", date: "2024-02-15" },
    ],
    events: [
      { title: "Roadmap", year: 2022, color: "#E3F2FD" },
      { title: "Budget", year: 2023, color: "#E8F5E9" },
    ],
  },
  {
    title: "Improve Healthcare Access",
    description: "Add 100 rural clinics and staff training programs.",
    href: "/promises/healthcare",
    status: { color: "#ed6c02", label: "At Risk" },
    statusHistory: [
      { color: "#ffcc80", date: "2022-11-20" },
      { color: "#ffb74d", date: "2023-08-10" },
      { color: "#ed6c02", date: "2024-03-05" },
    ],
    events: [
      { title: "RFP", year: 2023, color: "#FFF3E0" },
      { title: "Phase 1", year: 2024, color: "#FFE0B2" },
    ],
  },
  {
    title: "Expand Internet Connectivity",
    description: "Fiber backbone to all counties and school hotspots.",
    href: "/promises/connectivity",
    status: { color: "#0288d1", label: "In Progress" },
    statusHistory: [
      { color: "#81d4fa", date: "2022-05-01" },
      { color: "#4fc3f7", date: "2023-04-22" },
      { color: "#0288d1", date: "2024-06-30" },
    ],
    events: [
      { title: "Pilot", year: 2023, color: "#E1F5FE" },
      { title: "Rollout", year: 2024, color: "#B3E5FC" },
    ],
  },
];

const KeyPromiseCard = ({ item }: { item: Item }) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const titleVariant = isDesktop ? "h2" : "h3";

  return (
    <Grid
      container
      justifyContent="space-between"
      alignItems="stretch"
      sx={{ minWidth: 314, overflow: "visible" }}
      rowSpacing={{ xs: 0, lg: 2 }}
      columnSpacing={{ xs: 0, lg: 2 }}
    >
      <Grid size={{ xs: 12, lg: 5 }} sx={{ position: "relative" }}>
        <Box
          sx={{
            [theme.breakpoints.up("lg")]: {
              height: 387,
              mt: 3,
              position: "relative",
              width: "calc(((100vw - 100%) / 2) + 100%)",
            },
          }}
        >
          <Box
            sx={{
              background: `${item.status.color}`,
              border: `8px solid ${item.status.color}`,
              display: "block",
              mt: 3,
              minHeight: 155,
              maxWidth: 581,
              width: "100%",
              [theme.breakpoints.up("lg")]: {
                position: "absolute",
                inset: 0,
                m: 0,
              },
            }}
          />
        </Box>
      </Grid>
      <Grid
        size={{ xs: 12, lg: 6 }}
        container
        direction="column"
        justifyContent="space-between"
        sx={{ alignContent: "stretch" }}
      >
        <Grid>
          <Typography
            variant={titleVariant}
            sx={{
              mt: { xs: 1.5, lg: 3.5 },
              mb: { lg: 1 },
              position: { lg: "relative" },
              display: { lg: "flex" },
              flexDirection: { lg: "column" },
              "&:after": {
                content: '""',
                display: { lg: "block" },
                width: 72,
                borderBottom: { lg: `8px solid ${item.status.color}` },
              },
            }}
          >
            {item.title}
          </Typography>
          {isDesktop && item.description && (
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                mt: 4,
                maxHeight: 24 * 4,
                height: 24 * 4,
                overflowY: "hidden",
              }}
            >
              {item.description}
            </Typography>
          )}
        </Grid>
        {item.href && <CtAButton href={item.href}>{"Learn more"}</CtAButton>}
      </Grid>
      <Grid size={{ xs: 12 }} sx={{ order: 3 }}>
        <PromiseTimeline
          events={item.events || []}
          status={item.status}
          statusHistory={item.statusHistory}
          sx={{ mt: 5 }}
        />
      </Grid>
    </Grid>
  );
};

export const KeyPromises = ({ title }: KeyPromisesProps) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const stepperRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(() => placeholderItems, []);
  const steps = items.length;

  useEffect(() => {
    if (stepperRef.current) {
      const dotsEl = stepperRef.current.getElementsByClassName(
        "MuiMobileStepper-dots"
      )[0] as HTMLElement | undefined;
      if (dotsEl) {
        Array.from(dotsEl.childNodes).forEach((dotEl, i) => {
          (dotEl as HTMLElement).style.cursor = "pointer";
          dotEl.addEventListener("click", () => setActiveStep(i));
        });
      }
    }
  }, [stepperRef, setActiveStep]);

  const handleNext = () =>
    setActiveStep((prev) => Math.min(prev + 1, steps - 1));
  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  if (!items || items.length === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: (t) => t.palette.secondary.light,
        overflow: "visible",
        pb: { xs: 2.25, lg: 4 },
        pt: { xs: 4, lg: 5.75 },
      }}
    >
      <Container sx={{ overflow: "visible" }}>
        <Typography
          variant="h4"
          sx={{ m: 0 }}
          component="h2"
          gutterBottom={false}
        >
          {items.length === 1 ? "Key Promise" : title}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <KeyPromiseCard item={items[activeStep]} />
        </Box>

        {items.length > 1 && (
          <MobileStepper
            ref={stepperRef}
            steps={steps}
            position="static"
            variant="dots"
            activeStep={activeStep}
            backButton={
              steps === 0 ? undefined : (
                <IconButton onClick={handleBack} disabled={activeStep === 0}>
                  <KeyboardArrowLeft fontSize="inherit" />
                </IconButton>
              )
            }
            nextButton={
              steps === 0 ? undefined : (
                <IconButton
                  onClick={handleNext}
                  disabled={activeStep === steps - 1}
                >
                  <KeyboardArrowRight fontSize="inherit" />
                </IconButton>
              )
            }
            sx={{
              background: "inherit",
              justifyContent: "center",
              mt: { lg: 5 },
              "& .MuiIconButton-root": {
                color: "#909090",
                fontSize: 40,
                "&.Mui-disabled": {
                  color: (t) => t.palette.secondary.main,
                },
              },
              "& .MuiMobileStepper-dot": {
                bgcolor: (t) => t.palette.secondary.main,
                border: (t) => `1px solid ${t.palette.secondary.light}`,
                height: 8,
                mx: 1,
                width: 8,
                [theme.breakpoints.up("xl")]: {
                  height: 21,
                  mx: 2.5,
                  width: 21,
                },
              },
              "& .MuiMobileStepper-dotActive": {
                bgcolor: "#909090",
                border: "1px solid #909090",
              },
              "& .MuiMobileStepper-dots": { p: 0 },
            }}
          />
        )}
      </Container>
    </Box>
  );
};

export default KeyPromises;
