import serverFn from "@/promisetracker/lib/server";

/**
 * Load fact checks stories from PesaCheck site.
 */
function actnow(site) {
  const server = serverFn(site);

  const ACTNOW_URL = server.env("ACTNOW_URL");

  async function createAccount(user) {
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Token ${process.env.ACTNOW_API_KEY}`,
    });
    const response = await fetch(`${process.env.ACTNOW_URL}/v1/accounts/`, {
      method: "POST",
      headers,
      body: JSON.stringify(user),
    });
    return response.json();
  }

  async function loginUser(user) {
    const headers = new Headers({
      "content-type": "application/x-www-form-urlencoded",
      "cache-control": "no-cache",
    });
    const body = new URLSearchParams({
      grant_type: "password",
      ...user,
      client_id: process.env.ACTNOW_CLIENT_ID,
      client_secret: process.env.ACTNOW_CLIENT_SECRET,
    });
    const response = await fetch(`${process.env.ACTNOW_URL}/o/token/`, {
      method: "POST",
      headers,
      body: body.toString(),
    });
    return response.json();
  }

  async function getPetitions(query) {
    const url = `${ACTNOW_URL}/v1/petitions/?${`${query}&` || ""}format=json`;
    const response = await fetch(url);
    const petitions = response.ok ? await response.json() : [];

    // TODO(kilemensi): Remove hard-coded status once implemented in actNOW
    return petitions.map((petition) => ({ ...petition, status: "closed" }));
  }

  const api = {
    accounts: () => {
      return {
        create: (user) => {
          return (async () => {
            return createAccount(user);
          })();
        },
        login: (user) => {
          return (async () => {
            return loginUser(user);
          })();
        },
      };
    },
    petitions: (queryParam) => {
      return {
        get list() {
          return (async () => {
            return getPetitions(queryParam);
          })();
        },
      };
    },
  };

  return api;
}

export default actnow;
