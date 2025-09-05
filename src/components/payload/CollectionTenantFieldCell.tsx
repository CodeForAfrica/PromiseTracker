import { Link } from "@payloadcms/ui";
import type { DefaultServerCellComponentProps } from "payload";
import React from "react";

export const CollectionTenantFieldCell = async (
  props: DefaultServerCellComponentProps
) => {
  const { rowData, cellData, collectionSlug, payload } = props;

  const { id, tenant: tenatID } = rowData;

  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenatID,
  });

  return (
    <Link href={`/admin/collections/${collectionSlug}/${id}`}>
      {`${cellData}: ${tenant.country}`}
    </Link>
  );
};
