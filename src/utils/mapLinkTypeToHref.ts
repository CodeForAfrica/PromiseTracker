import formatPagePath from "./formatPagePath";

type LinkDoc = {
  relationTo: string;
  value: {
    slug?: string;
    [key: string]: any;
  };
};

type MapLinkTypeToHrefParams = {
  doc: LinkDoc;
  linkType: "internal" | "external" | string;
  url: string;
};

const mapLinkTypeToHref = ({
  doc: linkDoc,
  linkType,
  url,
}: MapLinkTypeToHrefParams) => {
  // default to `null` for serialization.
  let href = null;
  if (linkType === "internal") {
    const { relationTo: collection, value: doc } = linkDoc;
    if (doc?.slug) {
      href = formatPagePath(collection, doc);
    }
  } else {
    // custom link
    href = url;
  }
  return href;
};

export default mapLinkTypeToHref;
