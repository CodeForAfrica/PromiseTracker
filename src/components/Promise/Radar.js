import RichTypography from "@commons-ui/core/RichTypography";
import { makeStyles } from "@material-ui/core/styles";
import dynamic from "next/dynamic";
import PropTypes from "prop-types";
import React, { useEffect, useState } from "react";

import config from "@/promisetracker/config";

const MapIt = dynamic(() => import("@hurumap-ui/core/MapIt"), {
  ssr: false,
});

const useStyles = makeStyles(({ typography, breakpoints }) => ({
  root: {
    alignItems: "center",
    display: "flex",
    marginBottom: "2rem",
  },
  title: {
    padding: "1rem 0rem",
  },
  radar: {
    width: "100%",
    objectFit: "cover",
    height: typography.pxToRem(256),
    [breakpoints.up("lg")]: {
      width: typography.pxToRem(256),
    },
  },
}));

function Radar({ lat, long, ...props }) {
  const classes = useStyles({ ...props });
  const [tileLayer, setTileLayer] = useState();
  const { MAPIT_URL } = config;
  useEffect(() => {
    import("leaflet").then((leaflet) => {
      setTileLayer(
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
      );
    });
  }, []);

  return (
    <>
      <RichTypography variant="h5" className={classes.title}>
        Promise Radar:
      </RichTypography>
      <div className={classes.root}>
        <MapIt
          height="238.5px"
          width="100%"
          url={MAPIT_URL}
          zoom={4}
          tolerance={0.001}
          tileLayer={tileLayer}
          latLng={[lat || -1.28333, long || 36.81667]}
          center={[lat || 9.082, long || 8.6753]}
          drawProfile
          drawChildren
          codeType="KEN"
          geoLevel="country"
          geoCode="KE"
          geoLayerBlurStyle={{
            color: "black",
            fillColor: "transparent",
            weight: 1,
            opacity: 0.3,
            fillOpacity: 0.5,
          }}
          {...props}
        />
      </div>
    </>
  );
}

Radar.propTypes = {
  lat: PropTypes.number,
  long: PropTypes.number,
};

Radar.defaultProps = {
  lat: undefined,
  long: undefined,
};

export default Radar;
