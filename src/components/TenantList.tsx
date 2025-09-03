import { getGlobalPayload } from "@/lib/payload";
import Link from "next/link";
import { getDomain } from "@/lib/domain";

export const TenantList = async () => {
  const payload = await getGlobalPayload();
  const { port } = await getDomain();

  const { docs: tenants } = await payload.find({
    collection: "tenants",
    limit: -1,
  });

  return (
    <div className="tenant-list">
      <h2>Available Tenants</h2>
      <ul className="tenant-list">
        {tenants.map((t) => (
          <li key={t.id}>
            <Link
              href={`http://${t.country?.toLowerCase()}.localtest.me${port}`}
            >{`http://${t.country?.toLowerCase()}.localtest.me${port}`}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
