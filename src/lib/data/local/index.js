import { getPageProps } from "@/lib/data/common";
import api from "@/lib/payload/index";

export async function getPageStaticProps(context) {
  const props = await getPageProps(api, context);
  if (!props) {
    return { notFound: true };
  }
  return {
    props,
    revalidate: 60,
  };
}
