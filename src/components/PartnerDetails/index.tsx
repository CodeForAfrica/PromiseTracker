import { resolveMedia } from "@/lib/data/media";
import { getGlobalPayload } from "@/lib/payload";
import type { Partner, PartnerDetailsBlock } from "@/payload-types";
import { PartnerDetailsClient } from "./PartnerDetails.Client";

type PartnerDetailsProps = PartnerDetailsBlock & {
  entitySlug?: string;
};

export const PartnerDetails = async ({ partners, entitySlug }: PartnerDetailsProps) => {
  if (!partners?.length) {
    return null;
  }

  const payload = await getGlobalPayload();

  const { docs: partnersList } = await payload.find({
    collection: "partners",
    where: {
      id: {
        in: partners.map((partner) =>
          typeof partner === "string" ? partner : partner?.id
        ),
      },
    },
    depth: 0,
  });

  if (!partnersList.length) {
    return null;
  }

  const resolvedPartners = await Promise.all(
    partnersList.map(async (partnerDoc) => {
      const partner = partnerDoc as Partner;
      const media = await resolveMedia(partner.image);

      if (!media) {
        return null;
      }

      return {
        id: partner.id,
        name: partner.name,
        description: partner.description,
        url: partner.url,
        image: {
          url: media.url,
          alt: media.alt ?? "",
        },
      };
    })
  );

  const items = resolvedPartners.filter(
    (item): item is {
      id: string;
      name: string;
      description: Partner["description"];
      url: Partner["url"];
      image: { url: string; alt: string };
    } => Boolean(item)
  );

  if (!items.length) {
    return null;
  }

  return <PartnerDetailsClient partners={items} entitySlug={entitySlug} />;
};

export default PartnerDetails;
