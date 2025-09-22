"use client";

import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import {
  Box,
  Button,
  Container,
  Grid,
  IconButton,
  MobileStepper,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";

import { CMSLink } from "@/components/CMSLink";
import PromiseTimeline, {
  type TimelineEvent,
  type TimelineStatusHistoryItem,
} from "@/components/PromiseTimeline";

export type KeyPromiseItem = {
  id: string;
  title: string;
  description?: string;
  href?: string;
  imageUrl?: string;
  status: {
    color: string;
    label?: string;
    textColor?: string;
    date?: string;
  };
  statusHistory: TimelineStatusHistoryItem[];
  events: TimelineEvent[];
};

export type KeyPromisesClientProps = {
  title: string;
  actionLabel?: string | null;
  items: KeyPromiseItem[];
  timelineInterval: [number, number];
};

const KeyPromiseCard = ({
  item,
  actionLabel,
  timelineInterval,
}: {
  item: KeyPromiseItem;
  actionLabel?: string | null;
  timelineInterval: [number, number];
}) => {
  const theme = useTheme();
  const statusColor = item.status.color;

  return (
    <Grid
      container
      spacing={{ xs: 3, lg: 4 }}
      alignItems="stretch"
      sx={{
        overflow: "visible",
        minHeight: { lg: theme.typography.pxToRem(520) },
      }}
    >
      <Grid
        size={{ xs: 12, lg: 6 }}
        order={{
          xs: 1,
          lg: 2,
        }}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: { lg: theme.typography.pxToRem(580) },
            height: {
              xs: theme.typography.pxToRem(220),
              sm: theme.typography.pxToRem(280),
              lg: theme.typography.pxToRem(387),
            },
            border: `8px solid ${statusColor}`,
            backgroundImage: item.imageUrl
              ? `url(${item.imageUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </Grid>
      <Grid
        size={{ xs: 12, lg: 6 }}
        container
        direction="column"
        justifyContent="space-between"
        order={{
          xs: 2,
          lg: 1,
        }}
        sx={{ minHeight: { lg: theme.typography.pxToRem(387) } }}
      >
        <Grid>
          <Typography
            component="h3"
            sx={(theme) => ({
              typography: { xs: "h4", lg: "h2" },
              p: "0 !important",
              position: "relative",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: { xs: 3, lg: 2 },
              minHeight: { lg: theme.typography.pxToRem(56) },
              textTransform: "none",
              lineHeight: "48px",
              pb: 1,
              "&::after": {
                content: '""',
                width: theme.typography.pxToRem(72),
                borderBottom: { lg: `8px solid ${statusColor}` },
                marginTop: { lg: theme.typography.pxToRem(8) },
                position: "absolute",
                bottom: -2,
                left: 0,
              },
            })}
          >
            {item.title}
          </Typography>
          {item.description ? (
            <Typography
              variant="body2"
              sx={(theme) => ({
                display: { xs: "none", lg: "block" },
                fontSize: 13,
                mt: { lg: theme.typography.pxToRem(36) },
                overflow: "hidden",
                maxHeight: theme.typography.pxToRem(24 * 4),
              })}
            >
              {item.description}
            </Typography>
          ) : null}
        </Grid>
        {item.href && actionLabel ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: { xs: "center", lg: "flex-start" },
              borderTop: { lg: `1px solid ${theme.palette.primary.dark}` },
              pt: { lg: theme.typography.pxToRem(45) },
              mt: { xs: 2, lg: 0 },
            }}
          >
            <CMSLink
              type="custom"
              url={item.href}
              sx={{ textDecoration: "none" }}
            >
              <Button
                variant="contained"
                sx={{
                  border: `1px solid transparent`,
                  minHeight: 48,
                  minWidth: { xs: 98, lg: 158 },
                  textTransform: "none",
                  fontWeight: 600,
                  bgcolor: theme.palette.common.black,
                  color: theme.palette.common.white,
                  "&:hover": {
                    backgroundColor: theme.palette.common.black,
                    color: theme.palette.common.white,
                  },
                }}
              >
                {actionLabel}
              </Button>
            </CMSLink>
          </Box>
        ) : null}
      </Grid>
      <Grid size={{ xs: 12 }} order={3}>
        <PromiseTimeline
          status={item.status}
          statusHistory={item.statusHistory}
          events={item.events}
          interval={timelineInterval}
          sx={{ mt: { xs: 4, lg: 5 } }}
        />
      </Grid>
    </Grid>
  );
};

export const KeyPromisesClient = ({
  title,
  actionLabel,
  items,
  timelineInterval,
}: KeyPromisesClientProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const stepperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = stepperRef.current;
    if (!container) {
      return undefined;
    }

    const dots = Array.from(
      container.querySelectorAll<HTMLSpanElement>(".MuiMobileStepper-dot"),
    );

    const cleanups = dots.map((dot, index) => {
      const handleClick = () => setActiveStep(index);
      dot.addEventListener("click", handleClick);
      return () => dot.removeEventListener("click", handleClick);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const clampedStep = useMemo(
    () => Math.min(activeStep, Math.max(items.length - 1, 0)),
    [activeStep, items.length],
  );

  useEffect(() => {
    if (clampedStep !== activeStep) {
      setActiveStep(clampedStep);
    }
  }, [activeStep, clampedStep]);

  if (!items.length) {
    return null;
  }

  const hasMultiple = items.length > 1;
  const displayedTitle = items.length === 1 ? "Key Promise" : title;

  return (
    <Box
      sx={(theme) => ({
        backgroundColor: theme.palette.secondary.light,
        overflow: "visible",
        pt: {
          xs: theme.typography.pxToRem(33),
          lg: theme.typography.pxToRem(46),
        },
        pb: {
          xs: theme.typography.pxToRem(18),
          lg: theme.typography.pxToRem(32),
        },
      })}
    >
      <Container sx={{ overflow: "visible" }}>
        <Typography
          component="h2"
          variant="h4"
          sx={{ mb: { xs: 3, lg: 4 }, mt: 0 }}
        >
          {displayedTitle}
        </Typography>
        <KeyPromiseCard
          item={items[clampedStep]}
          actionLabel={actionLabel ?? undefined}
          timelineInterval={timelineInterval}
        />
        {hasMultiple ? (
          <MobileStepper
            ref={stepperRef}
            steps={items.length}
            position="static"
            variant="dots"
            activeStep={clampedStep}
            backButton={
              <IconButton
                onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))}
                disabled={clampedStep === 0}
                size="large"
                sx={{
                  color: clampedStep === 0 ? "secondary.main" : "#909090",
                  fontSize: 40,
                }}
                aria-label="Previous key promise"
              >
                <KeyboardArrowLeft fontSize="inherit" />
              </IconButton>
            }
            nextButton={
              <IconButton
                onClick={() =>
                  setActiveStep((prev) => Math.min(prev + 1, items.length - 1))
                }
                disabled={clampedStep === items.length - 1}
                size="large"
                sx={{
                  color:
                    clampedStep === items.length - 1
                      ? "secondary.main"
                      : "#909090",
                  fontSize: 40,
                }}
                aria-label="Next key promise"
              >
                <KeyboardArrowRight fontSize="inherit" />
              </IconButton>
            }
            sx={(theme) => ({
              background: "transparent",
              justifyContent: "center",
              mt: { lg: 5 },
              "& .MuiMobileStepper-dots": {
                p: 0,
              },
              "& .MuiMobileStepper-dot": {
                backgroundColor: theme.palette.secondary.main,
                border: `1px solid ${theme.palette.secondary.light}`,
                height: theme.typography.pxToRem(8),
                width: theme.typography.pxToRem(8),
                margin: `0 ${theme.typography.pxToRem(8)}`,
                cursor: "pointer",
                "&.MuiMobileStepper-dotActive": {
                  backgroundColor: "#909090",
                  borderColor: "#909090",
                  cursor: "default",
                },
                [theme.breakpoints.up("xl")]: {
                  height: theme.typography.pxToRem(21),
                  width: theme.typography.pxToRem(21),
                  margin: `0 ${theme.typography.pxToRem(20)}`,
                },
              },
            })}
          />
        ) : null}
      </Container>
    </Box>
  );
};

export default KeyPromisesClient;
