import { CollectionAfterReadHook } from "payload";

const newsletterSettingsToBlock: CollectionAfterReadHook = async ({
  doc,
  req,
}) => {
  if (doc.blocks && Array.isArray(doc.blocks)) {
    const processedBlocks = await Promise.all(
      doc.blocks.map(async (block: any) => {
        if (block.blockType === "newsletter") {
          try {
            const { docs } = await req.payload.find({
              collection: "site-settings",
              limit: 5,
              sort: "-createdAt",
              locale: req.locale,
              where: {
                tenant: {
                  equals: doc.tenant,
                },
              },
            });

            if (!docs.length) {
              return block;
            }
            const [settings] = docs;
            return {
              ...block,
              ...settings?.newsletter,
            };
          } catch (error) {
            req.payload.logger.error(
              `Error fetching documents for Newsletter block: ${error}`,
            );
            return block;
          }
        }
        return block;
      }),
    );

    return {
      ...doc,
      blocks: processedBlocks,
    };
  }
  return doc;
};

export default newsletterSettingsToBlock;
