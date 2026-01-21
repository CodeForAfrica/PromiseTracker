"use client";

import { useRef, useState, KeyboardEvent, TouchEvent } from "react";

import { Box } from "@mui/material";

export type EntityHeroCarouselImage = {
  url: string;
  alt: string;
};

type EntityHeroCarouselProps = {
  images: EntityHeroCarouselImage[];
};

export const EntityHeroCarousel = ({ images }: EntityHeroCarouselProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (!images.length) {
    return null;
  }

  const maxSteps = images.length;

  const handleDotSelect = (index: number) => {
    setActiveStep(index);
  };

  const handleDotKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDotSelect(index);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null || event.changedTouches.length !== 1) return;
    const deltaX = event.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) < 40) return;

    setActiveStep((prev) => {
      if (deltaX > 0) {
        return prev === 0 ? maxSteps - 1 : prev - 1;
      }
      return prev === maxSteps - 1 ? 0 : prev + 1;
    });
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 440,
        borderRadius: 1.25,
        overflow: "hidden",
        boxShadow: 4,
        position: "relative",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        component="img"
        src={images[activeStep].url}
        alt={images[activeStep].alt}
        loading="lazy"
        sx={{
          display: "block",
          width: "100%",
          aspectRatio: "5 / 3",
          objectFit: "cover",
          backgroundColor: "#d9d9d9",
          touchAction: "pan-y",
        }}
      />
      {maxSteps > 1 ? (
        <Box
          sx={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 1,
            px: 1,
            py: 0.5,
            borderRadius: 999,
            backgroundColor: "rgba(12, 12, 12, 0.55)",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
          }}
        >
          {images.map((_image, index) => {
            const isActive = index === activeStep;
            return (
              <Box
                key={index}
                role="button"
                tabIndex={0}
                aria-label={`Show image ${index + 1} of ${maxSteps}`}
                onClick={() => handleDotSelect(index)}
                onKeyDown={(event) => handleDotKeyDown(event, index)}
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: isActive
                    ? "#ffffff"
                    : "rgba(255, 255, 255, 0.5)",
                  border: isActive
                    ? "1px solid #ffffff"
                    : "1px solid transparent",
                  transition:
                    "background-color 150ms ease, opacity 150ms ease, transform 150ms ease",
                  cursor: "pointer",
                  outline: "none",
                  "&:focus-visible": {
                    boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.7)",
                  },
                }}
              />
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
};
