import { Block } from "payload";

const PromiseList: Block = {
  slug: "promise-list",
  imageURL: "/cms/promises-list.png",
  labels: {
    singular: "Promise List",
    plural: "Promise Lists",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: false,
      localized: false,
    },
    {
      name: "filterByLabel",
      type: "text",
      required: false,
      localized: true,
      defaultValue: "Filter By",
    },
    {
      name: "sortByLabel",
      type: "text",
      required: false,
      localized: true,
      defaultValue: "Sort By",
    },
    {
      name: "filterBy",
      type: "select",
      hasMany: true,
      options: [
        {
          label: "Status",
          value: "status",
        },
        {
          label: "Category",
          value: "category",
        },
      ],
      defaultValue: "status",
      required: false,
      localized: false,
    },
    {
      name: "sortBy",
      type: "select",
      hasMany: true,

      options: [
        {
          label: "Most Recent",
          value: "mostRecent",
        },
        {
          label: "Deadline",
          value: "deadline",
        },
      ],
      defaultValue: "mostRecent",
      required: false,
      localized: false,
    },
  ],
};

export default PromiseList;
