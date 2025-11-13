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
      image={image ?? undefined}
      title={title ?? null}
      href={href}
      imageSx={{
        border: `8px solid ${status.colors?.color}`,
        backgroundColor: status.colors?.color || "#000",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      status={status}
    >
      <Status {...status} />
    </PostCard>
  );
};

export default PromiseCard;
