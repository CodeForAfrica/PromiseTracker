import { resolveMedia } from "@/lib/data/media";
import type { PageHeaderBlock } from "@/payload-types";

import { PageHeaderClient } from "./PageHeaderClient";

const PageHeader = async ({
  title,
  description,
  image,
}: PageHeaderBlock) => {
  const resolvedImage = await resolveMedia(image ?? null);

  return (
    <PageHeaderClient
      title={title}
      description={description}
      image={resolvedImage}
    />
  );
};

export default PageHeader;
