"use client";

import { useState, KeyboardEvent } from "react";

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

  if (!images.length) {
    return null;
  }

  const maxSteps = images.length;

  const handleDotSelect = (index: number) => {
    setActiveStep(index);
  };

  const handleDotKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDotSelect(index);
    }
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
            px: 0.5,
            py: 0.25,
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
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: isActive ? "primary.main" : "#d9d9d9",
                  opacity: isActive ? 1 : 0.8,
                  transition: "background-color 150ms ease, opacity 150ms ease",
                  cursor: "pointer",
                  outline: "none",
                  "&:focus-visible": {
                    boxShadow: "0 0 0 2px rgba(25, 118, 210, 0.5)",
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
