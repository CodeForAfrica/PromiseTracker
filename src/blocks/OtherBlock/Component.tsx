import { OtherBlock as OtherBlockProps } from "@/payload-types";
import { Card, Typography } from "@mui/material";

export default async function OtherBlock(props: OtherBlockProps) {
  return (
    <Card>
      <Typography>TestBlock Component</Typography>
      <Typography>{props.title}</Typography>
    </Card>
  );
}
