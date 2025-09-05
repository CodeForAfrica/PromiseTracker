"use client";

import React from "react";
import { Container, type ContainerProps } from "@mui/material";
import { styled } from "@mui/material/styles";

type SectionProps = ContainerProps & { fixed?: boolean };

const SectionRoot = styled(Container)<SectionProps>(({ theme, fixed }) => {
  if (!fixed) return {};
  const content = (theme as any).contentWidths;
  const values = content?.values as Record<string, number> | undefined;
  if (!values) return {};
  const unit = content?.unit ?? "px";
  const styles: Record<string, any> = {};
  Object.keys(values).forEach((breakpoint) => {
    const value = values[breakpoint];
    if (value) {
      styles[(theme as any).breakpoints.up(breakpoint)] = {
        maxWidth: `${value}${unit}`,
      };
    }
  });
  return styles;
});

const Section = React.forwardRef<HTMLDivElement, SectionProps>(function Section(
  { disableGutters = true, fixed = true, ...others },
  ref,
) {
  return (
    <SectionRoot
      {...others}
      disableGutters={disableGutters}
      fixed={fixed}
      ref={ref}
    />
  );
});

export default Section;
