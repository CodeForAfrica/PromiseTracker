import { TenantList } from "./TenantList";

// TODO: (@kelvinkipruto): This should be configured from Payload
export const CommonHomePage = async () => {
  return (
    <>
      <div className="home">
        <div className="content">
          <div>
            <h2>Tenant not found</h2>
            <p>Please select from one of the available tenants:</p>
            <TenantList />
          </div>
        </div>
      </div>
    </>
  );
};
