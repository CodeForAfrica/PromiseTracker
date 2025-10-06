import ActNow from "@/blocks/ActNow/Component";
import { HomePage, Page, PoliticalEntity } from "@/payload-types";
import { Fragment, type ComponentType } from "react";
import { KeyPromises } from "./KeyPromises";
import Newsletter from "./Newsletter";
import Partners from "./Partners";
import LatestPromises from "./LatestPromises";
import { Hero } from "./Hero";
import Promises from "./Promises";
import { TenantList } from "./TenantList";
import { PoliticalEntityList } from "./PoliticalEntityList";
import PageHeader from "./PageHeader";

type PageBlocks = NonNullable<Page["blocks"]>;
type PageBlock = PageBlocks extends Array<infer T> ? T : never;

type TenantSelectorBlocks = HomePage["tenantSelector"]["blocks"];
type TenantSelectionBlockBase =
  TenantSelectorBlocks extends Array<infer T> ? T : never;
type TenantSelectionBlock = TenantSelectionBlockBase;

type EntitySelectorBlocks = HomePage["entitySelector"]["blocks"];
type EntitySelectionBlockBase =
  EntitySelectorBlocks extends Array<infer T> ? T : never;
type EntitySelectionBlock = EntitySelectionBlockBase & {
  pageSlugs?: string[];
};

type ResolvedBlock = PageBlock | TenantSelectionBlock | EntitySelectionBlock;

type BlockProps = {
  blocks: ResolvedBlock[] | null | undefined;
  entity?: PoliticalEntity;
};

const blockComponents: Record<string, ComponentType<any>> = {
  "act-now": ActNow,
  hero: Hero,
  newsletter: Newsletter,
  partners: Partners,
  "latest-promises": LatestPromises,
  "promise-list": Promises,
  "key-promises": KeyPromises,
  "tenant-selection": TenantList,
  "entity-selection": PoliticalEntityList,
  "page-header": PageHeader,
};

export const BlockRenderer = ({ blocks, entity }: BlockProps) => {
  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0;

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block;
          if (!blockType) {
            return null;
          }

          const key =
            ("id" in block && block.id) ||
            ("blockName" in block && block.blockName) ||
            index;

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType];
            if (Block) {
              return (
                <div key={String(key)}>
                  <Block {...block} entitySlug={entity?.slug} />
                </div>
              );
            }
          }

          return null;
        })}
      </Fragment>
    );
  }
  return null;
};
