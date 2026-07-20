import { socialLinks } from "@/fields/socialLinks";
import { Tab } from "payload";

import {
  validateNewsletterEmbedCodeField,
  validateNewsletterSignupUrlField,
} from "@/lib/embeds/validation";

export const EngagementTab: Tab = {
  label: {
    en: "Engagement",
    fr: "Fiançailles",
  },
  fields: [
    {
      name: "connect",
      type: "group",
      label: {
        en: "Social Accounts",
        fr: "Comptes sociaux",
      },
      fields: [
        {
          type: "collapsible",
          label: {
            en: "Title & Links",
            fr: "Titre et liens",
          },
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
              label: {
                en: "Title",
                fr: "Titre",
              },
              localized: true,
              admin: {
                description: {
                  en: "Text that appears on contact links e.g Stay in Touch",
                  fr: "Texte qui apparaît sur les liens de contact, par exemple «Restez en contact»",
                },
              },
            },
            socialLinks(),
          ],
        },
      ],
    },
    {
      name: "newsletter",
      type: "group",
      label: {
        en: "Email Newsletter",
        fr: "Newsletter par e-mail",
      },
      fields: [
        {
          type: "collapsible",
          label: "Title & Signup Form",
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
              localized: true,
            },
            {
              name: "description",
              type: "textarea",
              required: true,
              localized: true,
            },
            {
              name: "signupUrl",
              type: "text",
              label: {
                en: "Signup Form URL",
                fr: "URL du formulaire d'inscription",
              },
              validate: (value: string | null | undefined) =>
                validateNewsletterSignupUrlField(value),
              admin: {
                description: {
                  en: "Preferred. The Mailchimp form action URL, e.g. https://example.us1.list-manage.com/subscribe/post?u=…&id=…. Only approved newsletter providers are accepted.",
                  fr: "Recommandé. L'URL d'action du formulaire Mailchimp, p. ex. https://example.us1.list-manage.com/subscribe/post?u=…&id=…. Seuls les fournisseurs approuvés sont acceptés.",
                },
              },
            },
            {
              name: "embedCode",
              type: "code",
              label: {
                en: "Embed Code (legacy)",
                fr: "Code d'intégration (hérité)",
              },
              validate: (
                value: string | null | undefined,
                {
                  siblingData,
                }: { siblingData: Partial<{ signupUrl?: string | null }> },
              ) => validateNewsletterEmbedCodeField(value, siblingData?.signupUrl),
              admin: {
                language: "html",
                description: {
                  en: "Legacy. Sanitized before rendering: scripts, iframes, event handlers, and forms posting to unapproved providers are removed. Prefer the Signup Form URL field above.",
                  fr: "Hérité. Assaini avant affichage : les scripts, iframes, gestionnaires d'événements et formulaires vers des fournisseurs non approuvés sont supprimés. Préférez le champ URL du formulaire ci-dessus.",
                },
              },
            },
          ],
        },
      ],
    },
    {
      name: "actNow",
      type: "group",
      label: {
        en: "Act Now Section",
        fr: "Section Agir maintenant",
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          localized: true,
          label: {
            en: "Title",
            fr: "Titre",
          },
        },
        {
          name: "share",
          type: "group",
          label: {
            en: "Share",
            fr: "Partager",
          },
          admin: {
            hideGutter: true,
          },
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
              localized: true,
              label: {
                en: "Share Title",
                fr: "Partager le titre",
              },
            },
            {
              name: "description",
              type: "textarea",
              required: true,
              localized: true,
              label: {
                en: "Share Description",
                fr: "Partager la description",
              },
            },
          ],
        },
      ],
    },
  ],
};
