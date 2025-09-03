import { OtherBlock as OtherBlockProps } from "@/payload-types";

export default async function OtherBlock(props: OtherBlockProps) {
  return (
    <div>
      <h1>TestBlock Component</h1>
      <h1>{props.title}</h1>
    </div>
  );
}
