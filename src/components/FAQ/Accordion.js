import React, { useState } from "react";
import PropTypes from "prop-types";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from "@material-ui/core";

import MinusIcon from "@/promisetracker/icons/Minus";
import PlusIcon from "@/promisetracker/icons/Plus";

import useStyles from "./useStyles";

function AccordionPanel({ faq, ...props }) {
  const classes = useStyles(props);
  const [expanded, setExpanded] = useState(false);
  const handleChange = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <Accordion
      onChange={handleChange}
      elevation={0}
      classes={{ root: classes.accordion, expanded: classes.accordionExpanded }}
    >
      <AccordionSummary
        expandIcon={expanded ? <MinusIcon /> : <PlusIcon />}
        classes={{
          root: classes.accordionSummary,
          content: classes.accordionSummaryContent,
        }}
      >
        <Typography variant="h4">{faq.title}</Typography>
      </AccordionSummary>
      <AccordionDetails classes={{ root: classes.accordionDetails }}>
        <Typography variant="body2">{faq.summary}</Typography>
      </AccordionDetails>
    </Accordion>
  );
}
AccordionPanel.propTypes = {
  faq: PropTypes.shape({
    title: PropTypes.string,
    summary: PropTypes.string,
  }).isRequired,
};

AccordionPanel.defaultProps = {};

export default AccordionPanel;