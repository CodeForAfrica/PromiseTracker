import React from "react";

import { Grid, List, ListItem, Collapse, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import Link from "@/promisetracker/components/Link";

import config from "@/promisetracker/config";

const useStyles = makeStyles(({ typography, palette }) => ({
  root: {},
  collapse: {
    margin: "1rem",
    borderLeft: `1.5px solid ${palette.secondary.dark}`,
  },
  listItem: {
    "&:hover": {
      backgroundColor: "unset",
    },
  },
  listItemText: {
    paddingTop: "2rem",
    color: palette.background.default,
    fontSize: typography.pxToRem(18),
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: "0.72px",
    fontFamily: typography.fontFamily,
    padding: "0rem 1rem",
  },
  indexlistItemText: {
    fontSize: typography.pxToRem(18),
    color: palette.background.default,
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: "0.72px",
    fontFamily: typography.fontFamily,
    padding: "0rem 1rem",
  },
  title: {
    color: palette.background.default,
    fontSize: typography.pxToRem(18),
    textTransform: "uppercase",
    fontWeight: 500,
    padding: "1rem 0rem",
  },
  items: {
    padding: "0rem 1.5rem",
    opacity: 0.5,
  },
}));

function ListItemLink(props) {
  return <Link {...props} variant="h4" />;
}

function NavigationList(props) {
  const classes = useStyles(props);
  const { analysisMenu } = config;

  const [open, setOpen] = React.useState(true);

  const handleClick = () => {
    setOpen(!open);
  };
  return (
    <Grid
      container
      direction="column"
      justify="space-between"
      className={classes.root}
    >
      <List component="nav" aria-labelledby="nested-list-subheader">
        <ListItem
          component="div"
          autoFocus={false}
          button
          className={classes.listItem}
        >
          <Typography variant="h4" className={classes.title}>
            Promises
          </Typography>
        </ListItem>

        <ListItem
          autoFocus={false}
          button
          onClick={handleClick}
          className={classes.listItem}
        >
          <Typography variant="h4" className={classes.title}>
            Analysis
          </Typography>
        </ListItem>

        <Collapse
          in={!open}
          timeout="auto"
          unmountOnExit
          // className={classes.collapse}
        >
          <List component="nav" className={classes.collapse}>
            {analysisMenu.map((item, i) => (
              <ListItemLink
                key={item.name}
                underline="none"
                href={item.href}
                as={item.href}
              >
                <Typography
                  variant="h4"
                  className={
                    i === 0 ? classes.indexlistItemText : classes.listItemText
                  }
                >
                  {item.name}
                </Typography>
              </ListItemLink>
            ))}
          </List>
        </Collapse>

        <ListItem
          component="div"
          autoFocus={false}
          button
          className={classes.listItem}
        >
          <Typography variant="h4" className={classes.title}>
            Act Now
          </Typography>
        </ListItem>
      </List>
    </Grid>
  );
}

export default NavigationList;
