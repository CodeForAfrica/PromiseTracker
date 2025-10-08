"use client";

import { useState, type SyntheticEvent } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  Typography,
  type AccordionProps,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical";

import { RichText } from "@/components/RichText";
import type { FAQBlock } from "@/payload-types";

import { MinusIcon, PlusIcon } from "./icons";

type FAQItem = Omit<FAQBlock["faqs"][number], "answer"> & {
  answer: DefaultTypedEditorState;
};

export type FAQProps = Omit<FAQBlock, "faqs"> & {
  faqs: FAQItem[];
  entitySlug?: string;
};

const StyledAccordion = styled((props: AccordionProps) => (
  <Accordion disableGutters square elevation={0} {...props} />
))(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  borderBottom: `2px solid ${theme.palette.secondary.main}`,
  boxShadow: "none",
  margin: 0,
  position: "relative",
  "&:before": {
    backgroundColor: theme.palette.secondary.main,
    height: 2,
    top: -2,
  },
  "&.Mui-expanded": {
    margin: 0,
    "&:before": {
      opacity: 1,
    },
  },
}));

const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
  padding: `0 ${theme.typography.pxToRem(14)}`,
  minHeight: "unset",
  "&.MuiAccordionSummary-root": {
    minHeight: "unset",
  },
  "& .MuiAccordionSummary-content": {
    margin: `${theme.typography.pxToRem(14)} 0`,
  },
  "& .MuiAccordionSummary-content.Mui-expanded": {
    margin: `${theme.typography.pxToRem(14)} 0`,
  },
}));

const StyledAccordionDetails = styled(AccordionDetails)(({ theme }) => ({
  padding: `${theme.typography.pxToRem(8)} ${theme.typography.pxToRem(14)} ${theme.typography.pxToRem(22)}`,
}));

const FAQAccordionItem = ({ question, answer }: FAQItem) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (_event: SyntheticEvent, value: boolean) => {
    setExpanded(value);
  };

  return (
    <StyledAccordion expanded={expanded} onChange={handleToggle}>
      <StyledAccordionSummary
        expandIcon={expanded ? <MinusIcon /> : <PlusIcon />}
      >
        <Typography
          variant="h4"
          sx={(theme) => ({
            fontSize: theme.typography.pxToRem(18),
            lineHeight: 24 / 18,
            textTransform: "uppercase",
            letterSpacing: theme.typography.pxToRem(0.64),
          })}
        >
          {question}
        </Typography>
      </StyledAccordionSummary>
      <StyledAccordionDetails>
        <RichText
          data={answer}
          sx={(theme) => ({
            fontFamily: theme.typography.body2.fontFamily,
            fontSize: theme.typography.body2.fontSize,
            lineHeight: theme.typography.body2.lineHeight,
            "& p": {
              margin: 0,
              marginBottom: theme.typography.pxToRem(16),
            },
          })}
        />
      </StyledAccordionDetails>
    </StyledAccordion>
  );
};

const FAQ = ({ title, faqs }: FAQProps) => {
  if (!faqs.length) {
    return null;
  }

  const heading = title?.trim();

  return (
    <Box
      component="section"
      sx={(theme) => ({
        backgroundColor: "transparent",
        marginBottom: theme.typography.pxToRem(52),
        [theme.breakpoints.up("lg")]: {
          marginBottom: theme.typography.pxToRem(59),
        },
      })}
    >
      <Container>
        {heading ? (
          <Typography
            variant="h2"
            component="h2"
            sx={(theme) => ({
              margin: `${theme.typography.pxToRem(32)} 0`,
              position: "relative",
              display: "inline-block",
              paddingBottom: theme.typography.pxToRem(4),
              fontWeight: 400,
              "&::after": {
                content: '""',
                position: "absolute",
                left: 0,
                bottom: 0,
                display: "block",
                width: theme.typography.pxToRem(80),
                borderBottom: "5px solid #000000",
              },
            })}
          >
            {heading}
          </Typography>
        ) : null}
        <Box
          sx={(theme) => ({
            marginTop: theme.typography.pxToRem(38),
            width: "100%",
            [theme.breakpoints.up("lg")]: {
              marginTop: theme.typography.pxToRem(42),
            },
          })}
        >
          {faqs.map((faq) => (
            <FAQAccordionItem
              key={faq.id ?? faq.question}
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default FAQ;
