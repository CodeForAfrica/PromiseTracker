import { TestBlock as TestBlockProps } from "@/payload-types";

export default async function TestBlock(props: TestBlockProps) {
  return (
    <div>
      <h1>TestBlock Component</h1>
      <h1>{props.title}</h1>
    </div>
  );
}
