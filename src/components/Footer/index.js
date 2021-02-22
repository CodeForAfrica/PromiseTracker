import React from "react";
import PropTypes from "prop-types";

import { Grid, Hidden, useMediaQuery } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";

import {
  A,
  FooterAbout,
  FooterCopyright,
  FooterLegalLinks,
  FooterLogo,
  FooterQuickLinks,
  FooterStayInTouch,
  Section,
} from "@commons-ui/core";

import Link from "@/promisetracker/components/Link";

import cfaLogo from "@/promisetracker/assets/logo-C4A.svg";
import ptLogo from "@/promisetracker/assets/footer-pt-logo.png";

import useStyles from "./useStyles";

function MainFooter({
  about,
  copyright,
  legalLinks: legalLinksProp,
  organizationLogo: organizationLogoProp,
  quickLinks: quickLinksProp,
  socialMedia,
  ...otherProps
}) {
  const classes = useStyles(otherProps);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

  const organizationLogo = {
    image: {
      url: organizationLogoProp?.image || cfaLogo,
      alt: organizationLogoProp?.alt || "Code for Africa",
    },
    url: organizationLogoProp?.link || "//codeforafrica.org",
  };
  const legalLinks = {
    linkComponent: Link,
    links: legalLinksProp?.map((l) => ({
      ...l,
      as: l.href,
      href: "/legal/[...slug]",
    })),
  };
  const quickLinks = quickLinksProp?.map((q) => {
    const hrefify = (href) => {
      const path = href.split("/").slice(0, 2).join("/");
      switch (path) {
        case "/about":
          return "/about/[slug]";
        default:
          return href;
      }
    };
    const linkify = ({ href: hrefProp = "", ...others }) => {
      const isRelativeHref =
        hrefProp.startsWith("/") && !hrefProp.startsWith("//");
      const component = isRelativeHref
        ? Link
        : React.forwardRef((props, ref) => <A ref={ref} {...props} />);
      const href = isRelativeHref ? hrefify(hrefProp) : hrefProp;
      const as = href !== hrefProp ? hrefProp : undefined;

      return {
        ...others,
        component,
        as,
        href,
      };
    };
    return {
      ...q,
      links: q.links.map(linkify),
    };
  });

  return (
    <div className={classes.root}>
      <div className={classes.primary}>
        <Section classes={{ root: classes.section }}>
          <FooterLogo
            hasDivider={false}
            {...organizationLogo}
            classes={{ organization: classes.organization }}
          />
          <Grid container>
            <Grid item xs={12} lg={8}>
              <FooterAbout
                options={{
                  about: {
                    variant: "body2",
                  },
                  initiative: {
                    variant: "body2",
                  },
                }}
                classes={{ aboutInitiative: classes.initiative }}
                initiative={about?.initiative}
              >
                {about?.about}
              </FooterAbout>
            </Grid>
            <Grid item lg={1} implementation="css" smDown component={Hidden} />
            {quickLinks?.length && (
              <>
                <Grid item xs={6} lg={2} className={classes.quickLinksMore}>
                  <div className={classes.links}>
                    <FooterQuickLinks
                      options={{
                        link: {
                          variant: "h6",
                        },
                        title: {
                          color: "black",
                          variant: "h3",
                        },
                      }}
                      classes={{ root: classes.quickLinks, link: classes.link }}
                      {...quickLinks[0]}
                    />
                  </div>
                </Grid>
                <Grid item xs={6} lg={1} className={classes.quickLinksContact}>
                  <div className={classes.links}>
                    <FooterQuickLinks
                      options={{
                        link: {
                          variant: "h6",
                        },
                        title: {
                          color: "black",
                          variant: "h3",
                        },
                      }}
                      classes={{ root: classes.quickLinks, link: classes.link }}
                      {...quickLinks[1]}
                    />
                  </div>
                </Grid>
              </>
            )}
          </Grid>
        </Section>
      </div>
      <div className={classes.secondary}>
        <Section classes={{ root: classes.section }}>
          <Grid container>
            <Grid item xs={12} lg={6} className={classes.secondaryGridItem}>
              <img
                className={classes.ptLogo}
                src={ptLogo}
                alt="promise Tracker"
              />
              <div className={classes.legalContainer}>
                {!isDesktop && socialMedia?.length && (
                  <FooterStayInTouch
                    socialMedia={socialMedia}
                    options={{
                      socialMedia: {
                        color: "textSecondary",
                      },
                      support: {
                        color: "textSecondary",
                      },
                      title: {
                        variant: "button",
                      },
                    }}
                    classes={{
                      root: classes.stayInTouch,
                      links: classes.stayInTouchLinks,
                      text: classes.stayInTouchText,
                      title: classes.stayInTouchTitle,
                    }}
                  />
                )}

                <FooterCopyright
                  {...copyright}
                  variant="button"
                  classes={{
                    copyright: classes.copyright,
                    text: classes.copyrightText,
                  }}
                />
                {legalLinksProp?.length && (
                  <FooterLegalLinks
                    variant="button"
                    {...legalLinks}
                    classes={{
                      root: classes.legalLinksRoot,
                      list: classes.legalLinks,
                      link: classes.legalLink,
                    }}
                  />
                )}
              </div>
            </Grid>
            {isDesktop && socialMedia?.length && (
              <Grid item xs={12} lg={6} className={classes.secondaryGridItem}>
                <FooterStayInTouch
                  socialMedia={socialMedia}
                  options={{
                    socialMedia: {
                      color: "textSecondary",
                    },
                    support: {
                      color: "textSecondary",
                    },
                    title: {
                      variant: "button",
                    },
                  }}
                  classes={{
                    root: classes.stayInTouch,
                    links: classes.stayInTouchLinks,
                    text: classes.stayInTouchText,
                  }}
                />
              </Grid>
            )}
          </Grid>
        </Section>
      </div>
    </div>
  );
}

MainFooter.propTypes = {
  about: PropTypes.shape({
    initiative: PropTypes.string,
    about: PropTypes.string,
  }),
  copyright: PropTypes.shape({}),
  legalLinks: PropTypes.arrayOf(PropTypes.shape({})),
  organizationLogo: PropTypes.shape({}),
  quickLinks: PropTypes.arrayOf(PropTypes.shape({})),
  socialMedia: PropTypes.arrayOf(PropTypes.shape({})),
};
MainFooter.defaultProps = {
  about: undefined,
  copyright: undefined,
  legalLinks: undefined,
  organizationLogo: undefined,
  quickLinks: undefined,
  socialMedia: undefined,
};

export default MainFooter;
