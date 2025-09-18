import ActNow from "@/blocks/ActNow/Component";
import { Page, PoliticalEntity } from "@/payload-types";
import { Fragment } from "react";
import Newsletter from "./Newsletter";
import Partners from "./Partners";
import LatestPromises from "./LatestPromises";
import { Hero } from "./Hero";

type BlockProps = {
  blocks: Page["blocks"];
  entity?: PoliticalEntity;
};

const blockComponents = {
  "act-now": ActNow,
  hero: Hero,
  newsletter: Newsletter,
  partners: Partners,
  "latest-promises": LatestPromises,
};

export const BlockRenderer = ({ blocks: b, entity }: BlockProps) => {
  const blocks = [
    ...b,
    {
      blockType: "latest-promises",
      title: "Latest Promises",
      actionLabel: "View All",
      items: [
        {
          title: "Promise 1",
          status: {
            title: "In Progress",
            label: "in-progress",
            color: "#FFA500",
          },
          href: "/promises/promise-1",
          image: "https://via.placeholder.com/300x200",
          description: "This is a brief description of Promise 1.",
        },
        {
          title: "Promise 2",
          status: {
            title: "Completed",
            label: "completed",
            color: "#008000",
          },
          href: "/promises/promise-2",
          image: "https://via.placeholder.com/300x200",
          description: "This is a brief description of Promise 1.",
        },
        {
          title: "Promise 3",
          date: "January 15, 2024",
          status: {
            title: "Not Started",
            label: "not-started",
            color: "#FF0000",
          },
          href: "/promises/promise-3",
          image: "https://via.placeholder.com/300x200",
          description: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio.
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer euismod odio non leo pretium pellentesque. Curabitur blandit urna cursus, malesuada erat ut, egestas odio.`,
        },
      ],
    },
  ];
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
