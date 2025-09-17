import ActNow from "@/blocks/ActNow/Component";
import { Page, PoliticalEntity } from "@/payload-types";
import { Fragment } from "react";
import { KeyPromises } from "./KeyPromises";
import Newsletter from "./Newsletter";
import Partners from "./Partners";

type BlockProps = {
  blocks: Page["blocks"];
  entity?: PoliticalEntity;
};

const blockComponents = {
  newsletter: Newsletter,
  partners: Partners,
  "act-now": ActNow,
  "key-promises": KeyPromises,
};
export const BlockRenderer = ({ blocks, entity }: BlockProps) => {
  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0;

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block;
          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType];
            if (Block) {
              return (
                <div key={index}>
                  {/* @ts-expect-error there may be some mismatch between the expected types here */}
                  <Block {...block} entitySlug={entity?.slug} />
                </div>
              );
            }
          }
        })}
      </Fragment>
    );
  }
  return null;
};
