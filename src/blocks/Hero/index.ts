import { Block } from "payload";

export const Hero: Block = {
  slug: "hero",
  interfaceName: "HeroBlock",
  imageURL: "/cms/hero.png",
  imageAltText: "Hero",
  fields: [
    {
      name: "tagline",
      type: "text",
      label: {
        en: "Tagline",
        fr: "Accroche",
      },
      admin: {
        description: {
          en: "Displayed alongside the political entity name in the hero.",
          fr: "Affiché avec le nom de l'entité politique dans le hero.",
        },
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "promiseLabel",
          type: "text",
          label: {
            en: "Promise Label",
            fr: "Libellé des promesses",
          },
          defaultValue: "promises",
        },
        {
          name: "trailText",
          type: "text",
          label: {
            en: "Trail Text",
            fr: "Texte complémentaire",
          },
          admin: {
            description: {
              en: "Sentence that follows the promise count, for example 'tracked on PromiseTracker'.",
              fr: "Phrase qui suit le nombre de promesses, par exemple 'suivi sur PromiseTracker'.",
            },
          },
          defaultValue: "tracked on PromiseTracker.",
        },
      ],
    },
    {
      name: "updatedAtLabel",
      type: "text",
      label: {
        en: "Updated At Label",
        fr: "Libellé de la date de mise à jour",
      },
      defaultValue: "Last updated",
    },
    {
      name: "profileTitleOverride",
      type: "text",
      label: {
        en: "Profile Title Override",
        fr: "Remplacement du titre du profil",
      },
      admin: {
        description: {
          en: "Optional text that replaces the political entity position shown above the last updated date.",
          fr: "Texte facultatif qui remplace la fonction de l'entité politique affichée au-dessus de la date de mise à jour.",
        },
      },
    },
    {
      name: "statusListTitle",
      type: "text",
      label: {
        en: "Status Popover Title",
        fr: "Titre de la fenêtre des statuts",
      },
      defaultValue: "What do the ratings mean?",
    },
    {
      name: "chartGroups",
      type: "array",
      minRows: 3,
      maxRows: 3,
      required: true,
      label: {
        en: "Chart Groups",
        fr: "Groupes du graphique",
      },
      labels: {
        singular: {
          en: "Group",
          fr: "Groupe",
        },
        plural: {
          en: "Groups",
          fr: "Groupes",
        },
      },
      admin: {
        description: {
          en: "Define exactly three groups of promise statuses to display in the charts.",
          fr: "Définissez exactement trois groupes de statuts de promesse à afficher dans les graphiques.",
        },
        components: {
          RowLabel: {
            path: "@/components/payload/RowLabel#CustomRowLabel",
            clientProps: {
              fieldToUse: "title",
            },
          },
        },
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          label: {
            en: "Group title",
            fr: "Titre du groupe",
          },
        },
        {
          name: "statuses",
          type: "relationship",
          relationTo: "promise-status",
          hasMany: true,
          required: true,
          label: {
            en: "Statuses",
            fr: "Statuts",
          },
        },
      ],
    },
  ],
};
