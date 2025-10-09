import React, { FC } from "react";

import PostCard from "@/components/PostCard/PostCard";
import Status from "@/components/PromiseStatus/PromiseStatus";
import { PromiseStatus, Media } from "@/payload-types";

interface Props {
  status: PromiseStatus;
  href?: string;
  title?: string | null;
  image?: Media | null;
  description?: string | null;
  createdAt?: string;
}

const PromiseCard: FC<Props> = function PromiseCard({
  status,
  href,
  title,
  image,
  description,
  createdAt,
}) {
  return (
    <PostCard
      createdAt={createdAt}
      description={description ?? undefined}
      image={image}
      title={title ?? null}
      href={href}
      imageSx={{
        border: `8px solid ${status.colors?.color}`,
        background: `linear-gradient(to right, ${status.colors?.color || "#000"}, ${status.colors?.color || "#000"}), url("${image?.url}") center center / cover no-repeat`,
      }}
      status={status}
    >
      <Status {...status} />
    </PostCard>
  );
};

export default PromiseCard;
