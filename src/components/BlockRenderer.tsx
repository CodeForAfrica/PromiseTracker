import { Page } from "@/payload-types";
import { Fragment } from "react";
import { KeyPromises } from "./KeyPromises";

type BlockProps = {
  blocks: Page["blocks"];
};

const blockComponents = {
  "key-promises": KeyPromises,
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
