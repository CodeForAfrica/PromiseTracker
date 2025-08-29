import { Block } from 'payload'

//TODO: (@kelvinkipruto):Delete this block: Only for Testing

export const TestBlock: Block = {
  slug: 'test-block',
  interfaceName: 'TestBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
  ],
}
