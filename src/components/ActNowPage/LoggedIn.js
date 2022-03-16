import { Box, Button } from "@material-ui/core";
import clsx from "clsx";
import { signOut } from "next-auth/react";
import Image from "next/image";
import PropTypes from "prop-types";
import React, { useState } from "react";

import useStyles from "./useStyles";

import actNowLogo from "@/promisetracker/assets/actNowLogo2x.png";
import ContentPage from "@/promisetracker/components/ContentPage";
import Section from "@/promisetracker/components/ContentPage/Section";
import IndividualRegistrationDialog from "@/promisetracker/components/IndividualRegistrationDialog";
import Petitions from "@/promisetracker/components/Petitions";
import Tabs from "@/promisetracker/components/Tabs";

function ActNowLoggedInPage({
  footer,
  title,
  onClose,
  navigation,
  onClick,
  signedPetitions,
  open: openProp,
  individualRegistrationDialogArgs,
  ownedPetitions,
  ...props
}) {
  const classes = useStyles(props);
  const [open, setOpen] = useState(openProp);
  const [openDialog, setOpenDialog] = useState();

  const handleClose = () => {
    setOpenDialog(undefined);
    if (onClose) {
      onClose();
    } else {
      setOpen(false);
    }
  };

  const handleClickIndividual = () => setOpenDialog("individual");

  const formatedItems = [
    { title: "Signed", petitions: signedPetitions },
    { title: "Started", petitions: ownedPetitions },
  ].map((item) => {
    return {
      label: `${item.title} (${item.petitions?.length || 0})`,
      href: `#${item.title}`,
      children: <Petitions items={item.petitions} />,
    };
  });

  const aside = (
    <Box display="flex" justifyContent="flex-end">
      <Button
        variant="outlined"
        onClick={() => signOut()}
        className={clsx(classes.accountButton, classes.accountLogout)}
      >
        Logout
      </Button>

      <Button
        variant="outlined"
        open={open}
        onClick={handleClickIndividual}
        className={clsx(classes.accountButton, classes.accountEdit)}
      >
        Edit
      </Button>

      <IndividualRegistrationDialog
        {...individualRegistrationDialogArgs}
        key={openDialog === "individual"}
        onClose={handleClose}
        open={openDialog === "individual"}
      />
    </Box>
  );
  return (
    <ContentPage
      {...props}
      footer={footer}
      navigation={navigation}
      title={title}
      content={
        <figure className={classes.logoFigureLoggedIn}>
          <Image
            src={actNowLogo}
            layout="fill"
            alt="actNOW"
            className={classes.image}
          />
        </figure>
      }
      contentProps={{ xs: 5, lg: 4 }}
      showTitle={false}
      aside={aside}
      asideProps={{ xs: 7, lg: 4 }}
      classes={{
        section: classes.section,
        sectionTitle: classes.sectionTitle,
        footer: classes.footer,
        grid: classes.grid,
        gridAside: classes.gridAside,
        gridContent: classes.gridContent,
      }}
    >
      <Section
        classes={{
          section: classes.section,
          sectionTitle: classes.sectionTitle,
        }}
        title="My Petitions"
        content={
          <Tabs
            name="signed-started-actnow"
            items={formatedItems}
            classes={{
              root: classes.tabs,
              tab: classes.tab,
            }}
          />
        }
      />
    </ContentPage>
  );
}

ActNowLoggedInPage.propTypes = {
  footer: PropTypes.shape({}),
  navigation: PropTypes.shape({}),
  signedPetitions: PropTypes.arrayOf(PropTypes.shape({})),
  ownedPetitions: PropTypes.arrayOf(PropTypes.shape({})),
  individualRegistrationDialogArgs: PropTypes.shape({}),
  open: PropTypes.bool,
  title: PropTypes.string,
  onClick: PropTypes.func,
  onClose: PropTypes.func,
};

ActNowLoggedInPage.defaultProps = {
  footer: undefined,
  navigation: undefined,
  ownedPetitions: undefined,
  signedPetitions: undefined,
  title: undefined,
  onClick: undefined,
  onClose: undefined,
  open: undefined,
  individualRegistrationDialogArgs: undefined,
};

export default ActNowLoggedInPage;
