import { TestBlock as TestBlockProps } from "@/payload-types";
import { Divider, Typography, Button } from "@mui/material";

export default async function TestBlock(props: TestBlockProps) {
  return (
    <div>
      <Typography variant="h1">TestBlock Component</Typography>
      <Typography variant="subtitle1">{props.title}</Typography>
      <Divider />
      <Button variant="contained">Hello world</Button>
    </div>
  );
}
