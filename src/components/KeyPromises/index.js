import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

import { IconButton, MobileStepper } from "@material-ui/core";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@material-ui/icons";

import { Section } from "@commons-ui/core";

import KeyPromise from "./KeyPromise";
import useStyles from "./useStyles";

const DEFAULT_TITLE_PROPS = {
  variant: "h4",
};

function KeyPromises({ actionLabel, items, title, titleProps, ...props }) {
  const classes = useStyles(props);
  const [activeStep, setActiveStep] = useState(0);
  const stepperRef = useRef();
  useEffect(() => {
    if (stepperRef.current) {
      const dotsEl = stepperRef.current.getElementsByClassName(
        "MuiMobileStepper-dots"
      )[0];
      if (dotsEl) {
        dotsEl.childNodes.forEach((dotEl, i) => {
          dotEl.addEventListener("click", () => setActiveStep(i));
        });
      }
    }
  }, [stepperRef, setActiveStep]);
  const steps = items.length;
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  return (
    <div className={classes.root}>
      <Section
        title={title}
        titleProps={{ ...DEFAULT_TITLE_PROPS, ...titleProps }}
        classes={{ root: classes.section, title: classes.sectionTitle }}
      >
        <KeyPromise
          key={items[activeStep].title}
          actionLabel={actionLabel}
          {...items[activeStep]}
          {...props}
        />
        <MobileStepper
          ref={stepperRef}
          steps={steps}
          position="static"
          variant="dots"
          activeStep={activeStep}
          backButton={
            <IconButton
              onClick={handleBack}
              disabled={activeStep === 0}
              className={classes.stepperButton}
            >
              <KeyboardArrowLeft fontSize="inherit" />
            </IconButton>
          }
          nextButton={
            <IconButton
              onClick={handleNext}
              disabled={activeStep === steps - 1}
              className={classes.stepperButton}
            >
              <KeyboardArrowRight fontSize="inherit" />
            </IconButton>
          }
          classes={{
            root: classes.stepper,
            dot: classes.stepperDot,
            dotActive: classes.stepperDotActive,
            dots: classes.stepperDots,
          }}
        />
      </Section>
    </div>
  );
}

KeyPromises.propTypes = {
  actionLabel: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      status: PropTypes.arrayOf(
        PropTypes.shape({
          color: PropTypes.string.isRequired,
        })
      ),
    })
  ),
  title: PropTypes.string,
  titleProps: PropTypes.shape({}),
};

KeyPromises.defaultProps = {
  actionLabel: undefined,
  items: undefined,
  title: undefined,
  titleProps: undefined,
};

export default KeyPromises;
