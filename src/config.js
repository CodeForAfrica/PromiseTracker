const config = {
  navigationMenu: [
    {
      name: "Promises",
      href: "/promises",
    },
    {
      name: "Analysis",
      href: "/analysis",
      analysisMenu: [
        {
          name: "one",
          url: "/one",
        },
        {
          name: "two",
          url: "/two",
        },
        {
          name: "thre",
          url: "/three",
        },
      ],
    },
    {
      name: "Act Now",
      href: "/actnow",
    },
  ],
};

export default config;
