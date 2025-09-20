import ActNow from "@/blocks/ActNow/Component";
import { Page, PoliticalEntity } from "@/payload-types";
import { Fragment } from "react";
import Newsletter from "./Newsletter";
import Partners from "./Partners";
import LatestPromises from "./LatestPromises";
import { Hero } from "./Hero";
import Promises from "./Promises";

type BlockProps = {
  blocks: Page["blocks"];
  entity?: PoliticalEntity;
};

const blockComponents: Record<string, React.FC<any>> = {
  "act-now": ActNow,
  hero: Hero,
  newsletter: Newsletter,
  partners: Partners,
  "latest-promises": LatestPromises,
  "promise-list": Promises,
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
