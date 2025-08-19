import { GlobalConfig } from 'payload'

export const Settings: GlobalConfig = {
  slug: 'settings',
  fields: [
    {
      type: 'tabs',
      label: 'Airtable',
      tabs: [
        {
          label: 'Airtable',
          fields: [
            {
              name: 'airtable',
              type: 'group',
              label: '',
              admin: {
                hideGutter: true,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'airtableAPIKey',
                      label: 'Airtable API Key',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'airtableBaseID',
                      type: 'text',
                      required: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Generative AI',
          fields: [
            {
              name: 'ai',
              type: 'group',
              label: '',
              admin: {
                hideGutter: true,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'model',
                      type: 'select',
                      options: [
                        {
                          value: 'gemini-2.5-pro',
                          label: 'Gemini 2.5 Pro',
                        },
                      ],
                      required: true,
                    },
                    {
                      name: 'apiKey',
                      type: 'text',
                      required: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Meedan',
          fields: [
            {
              name: 'meedan',
              type: 'group',

              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'meedanAPIKey',
                      type: 'text',
                      required: true,
                      label: 'Meedan API Key',
                    },
                    {
                      name: 'teamId',
                      type: 'text',
                      required: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
