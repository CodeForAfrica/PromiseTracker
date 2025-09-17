import { image } from "@/fields/image";
import { Block } from "payload";

export const Hero: Block = {
  slug: "hero",
  interfaceName: "HeroBlock",
  imageURL: "/cms/hero.png",
  imageAltText: "Hero",
  fields: [
    {
      name: "tagline",
      type: "richText",
      label: {
        en: "Tagline",
        fr: "Accroche",
      },
      admin: {
        description: {
          en: "Displayed as the main heading for the political entity page.",
          fr: "Affiché comme titre principal de la page de l'entité politique.",
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
    image({
      name: "fallbackImage",
      label: {
        en: "Fallback Profile Image",
        fr: "Image de profil de secours",
      },
      admin: {
        description: {
          en: "Used when the political entity record does not contain an image.",
          fr: "Utilisé lorsque l'entité politique n'a pas d'image.",
        },
      },
      required: false,
    }),
    {
      name: "statusInfo",
      type: "group",
      label: {
        en: "Status Info Popover",
        fr: "Info-bulle des statuts",
      },
      fields: [
        {
          name: "title",
          type: "text",
          label: {
            en: "Title",
            fr: "Titre",
          },
          defaultValue: "Promise status definitions",
        },
        {
          name: "items",
          type: "array",
          label: {
            en: "Items",
            fr: "Éléments",
          },
          labels: {
            singular: {
              en: "Item",
              fr: "Élément",
            },
            plural: {
              en: "Items",
              fr: "Éléments",
            },
          },
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
              label: {
                en: "Status",
                fr: "Statut",
              },
            },
            {
              name: "description",
              type: "textarea",
              required: true,
              label: {
                en: "Description",
                fr: "Description",
              },
            },
          ],
        },
      ],
    },
    {
      name: "chartCaptions",
      type: "group",
      label: {
        en: "Chart Captions",
        fr: "Légendes du graphique",
      },
      fields: [
        {
          name: "kept",
          type: "text",
          label: {
            en: "Promises kept caption",
            fr: "Légende « Promesse tenue »",
          },
          defaultValue: "Promise kept",
        },
        {
          name: "uncertain",
          type: "text",
          label: {
            en: "Uncertain caption",
            fr: "Légende « Incertain »",
          },
          defaultValue: "Uncertain",
        },
        {
          name: "notKept",
          type: "text",
          label: {
            en: "Promises not kept caption",
            fr: "Légende « Promesse non tenue »",
          },
          defaultValue: "Promise not kept",
        },
      ],
    },
  ],
};
