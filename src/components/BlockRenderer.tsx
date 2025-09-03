import OtherBlock from "@/blocks/OtherBlock/Component";
import TestBlock from "@/blocks/TestBlock/Component";
import { Page } from "@/payload-types";
import { Fragment } from "react";

type BlockProps = {
  blocks: Page["blocks"];
};

const blockComponents = {
  "test-block": TestBlock,
  "other-block": OtherBlock,
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
