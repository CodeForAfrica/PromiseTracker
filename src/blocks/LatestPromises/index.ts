import { Block } from "payload";

const LatestPromises: Block = {
  slug: "latest-promises",
  imageURL: "/cms/latest-promises.png",
  interfaceName: "LatestPromisesBlock",
  labels: {
    singular: "Latest Promise",
    plural: "Latest Promises",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "seeAllLink",
      type: "text",
      required: false,
      localized: true,
      admin: {
        description:
          "Link to the page where all promises can be viewed. E.g. /promises",
      },
    },
  ],
};

export default LatestPromises;
