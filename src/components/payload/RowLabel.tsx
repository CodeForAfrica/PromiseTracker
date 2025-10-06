"use client";

import { useRowLabel, RowLabel, RowLabelProps } from "@payloadcms/ui";

export const LinkGroupRowLabel = () => {
  const data: any = useRowLabel();
  const {
    data: { link: { label = "" } = {} },
  } = data;

  return <RowLabel {...data} label={label} />;
};

type CustomRowLabelProps = {
  fieldToUse: string;
} & RowLabelProps;

export const CustomRowLabel = ({ fieldToUse }: CustomRowLabelProps) => {
  const data: any = useRowLabel();
  const label = data?.data[fieldToUse];

  return <RowLabel {...data} label={label} />;
};
