import React from "react";

import { Grid, List, ListItem, Collapse, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import Link from "@/promisetracker/components/Link";

import config from "@/promisetracker/config";

const useStyles = makeStyles(({ typography, palette }) => ({
  root: {
    padding: "1rem",
  },
  collapse: {
    borderLeft: `1.5px solid ${palette.secondary.dark}`,
  },
  listItem: {
    padding: "2rem 0rem",
    "&:hover": {
      backgroundColor: "unset",
    },
  },
  listItemText: {
    paddingTop: "2rem",
    color: "white",
    fontSize: typography.pxToRem(18),
    textTransform: "uppercase",
    fontWeight: 500,
  },
  indexlistItemText: {
    color: "white",
    fontSize: typography.pxToRem(18),
    textTransform: "uppercase",
    fontWeight: 500,
  },
  title: {
    color: palette.background.default,
    fontSize: typography.pxToRem(18),
    textTransform: "uppercase",
    fontWeight: 500,
  },
  items: {
    padding: "0rem 3rem",
    opacity: 0.5,
  },
}));

function ListItemLink(props) {
  const classes = useStyles();
  return (
    <Link {...props} variant="subtitle2" className={classes.listItemLink} />
  );
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
      <List
        component="nav"
        aria-labelledby="nested-list-subheader"
        className={classes.list}
      >
        <ListItem autoFocus={false} button className={classes.listItem}>
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
          className={classes.collapse}
        >
          <Grid item>
            <List component="nav" className={classes.items}>
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
          </Grid>
        </Collapse>

        <ListItem autoFocus={false} button className={classes.listItem}>
          <Typography variant="h4" className={classes.title}>
            Act Now
          </Typography>
        </ListItem>
      </List>
    </Grid>
  );
}

export default NavigationList;
