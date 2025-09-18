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
  image?: string;
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
      title={title}
      href={href}
      imageSx={{
        background: `linear-gradient(to right, ${status?.color}, ${status?.color}), url("${image}") no-repeat center/cover`,
      }}
    >
      <Status {...status} />
    </PostCard>
  );
};

export default PromiseCard;
