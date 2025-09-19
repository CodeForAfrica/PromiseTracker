import React, { FC } from "react";

import PostCard from "@/components/PostCard/PostCard";
import Status from "@/components/PromiseStatus/PromiseStatus";

interface Props {
  status: {
    title: string;
    label: string;
    color: string;
  };
  href?: string;
  title: string;
  image?: {
    url: string;
    alt?: string;
  };
}
const PromiseCard: FC<Props> = function PromiseCard({
  status,
  href,
  title,
  image,
  ...props
}) {
  return (
    <PostCard
      {...props}
      image={image}
      title={title}
      href={href}
      imageSx={{
        border: `8px solid ${status.color}`,
        background: `linear-gradient(to right, ${status.color}, ${status.color}), url("${image?.url}") center center / cover no-repeat`,
      }}
    >
      <Status {...status} />
    </PostCard>
  );
};

export default PromiseCard;
