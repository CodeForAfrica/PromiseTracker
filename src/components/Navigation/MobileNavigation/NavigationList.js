import React from "react";

import {
  Grid,
  List,
  ListItem,
  ListItemText,
  Collapse,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(() => ({
  root: {
    padding: "1rem",
  },
  listItem: {
    "&:hover": {
      backgroundColor: "unset",
    },
  },
}));

function NavigationList(props) {
  const classes = useStyles(props);
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
          <ListItemText primary="Promises" className={classes.ListItemText} />
        </ListItem>

        <ListItem
          autoFocus={false}
          button
          onClick={handleClick}
          className={classes.listItem}
        >
          <ListItemText primary="Analysis" className={classes.ListItemText} />
        </ListItem>

        <Collapse in={!open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem button className={classes.nested}>
              <ListItemText primary="Starred" />
            </ListItem>
          </List>
        </Collapse>

        <ListItem autoFocus={false} button className={classes.listItem}>
          <ListItemText primary="Act Now" className={classes.ListItemText} />
        </ListItem>
      </List>
    </Grid>
  );
}

export default NavigationList;
