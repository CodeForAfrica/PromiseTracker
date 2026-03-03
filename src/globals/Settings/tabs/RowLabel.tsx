"use client";

import { Setting } from "@/payload-types";
import { RowLabelProps, useRowLabel } from "@payloadcms/ui";

type AISetting = NonNullable<Setting["ai"]["providerCredentials"]>[number];

export const AIProviderRowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<AISetting>();
  const providerLabel = data?.data?.provider || "New provider";

  return (
    <div>
      <span
        style={{
          textTransform: "capitalize",
        }}
      >
        {providerLabel}
      </span>
    </div>
  );
};
