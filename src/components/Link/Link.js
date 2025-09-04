"use client";

/* eslint-env browser */
import clsx from "clsx";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";

import StyledLink, { isExternalUrl } from "./StyledLink";

function checkIfPathsMatch(linkPath, currentPath) {
  return linkPath === currentPath;
}

const PagesRouterLink = React.forwardRef(function PagesRouterLink(props, ref) {
  const {
    activeClassName = "active",
    as,
    className: classNameProp,
    href,
    isActive: isActiveProp,
    linkAs: linkAsProp,
    ...other
  } = props;

  const pathname = usePathname();
  const [className, setClassName] = useState(classNameProp);
  const isActive = isActiveProp || checkIfPathsMatch;
  const isInternalLink = !isExternalUrl(
    typeof href === "string" ? href : href.pathname,
  );
  const linkAs = linkAsProp || as;

  useEffect(() => {
    if (isInternalLink) {
      const linkPathname = new URL(linkAs || href, window.location.href)
        .pathname;
      const currentPathname = pathname;
      const newClassName = clsx(classNameProp, {
        [activeClassName]: isActive(linkPathname, currentPathname),
      });
      if (newClassName !== className) {
        setClassName(newClassName);
      }
    }
  }, [
    activeClassName,
    pathname,
    className,
    classNameProp,
    href,
    isActive,
    isInternalLink,
    linkAs,
  ]);

  return (
    <StyledLink
      {...other}
      as={as}
      className={className}
      href={href}
      linkAs={linkAsProp}
      ref={ref}
    />
  );
});

export default PagesRouterLink;
