import React from "react";

import { MenuItem, MenuList, Link } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: 0,
  },
  menuItem: {
    "&.MuiListItem-button:hover": {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.primary.main,
    },
    // ListItem classes are set using .Mui-selected & hence we need to override
    // them the same way; Would have preferred via `selected` but alas!
    "&.Mui-selected": {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.text.secondary,
    },
    "&.Mui-selected:hover": {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.text.secondary,
    },
  },
}));

function CustomMenuItem(props) {
  return <MenuItem component={Link} divider color="secondary" {...props} />;
}

function NavMenuList() {
  const classes = useStyles();
  return (
    <div>
      <MenuList classes={{ root: classes.root }}>
        <CustomMenuItem>one</CustomMenuItem>
        <CustomMenuItem>Two</CustomMenuItem>
        <CustomMenuItem>Three</CustomMenuItem>
      </MenuList>
    </div>
  );
}

export default NavMenuList;
