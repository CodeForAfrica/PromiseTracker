import { Page } from "@/payload-types";
import { Fragment } from "react";
import Newsletter from "./Newsletter";
import Partners from "./Partners";

type BlockProps = {
  blocks: Page["blocks"];
};

const blockComponents = {
  newsletter: Newsletter,
  partners: Partners,
};
export const BlockRenderer = ({ blocks }: BlockProps) => {
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
                  <Block {...block} />
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
