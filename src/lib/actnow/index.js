import jwtDecode from "jwt-decode";

import serverFn from "@/promisetracker/lib/server";

/**
 * Load fact checks stories from PesaCheck site.
 */
function actnow(site) {
  const server = serverFn(site);

  const ACTNOW_API_KEY = server.env("ACTNOW_API_KEY");
  const ACTNOW_CLIENT_ID = server.env("ACTNOW_CLIENT_ID");
  const ACTNOW_CLIENT_SECRET = server.env("ACTNOW_CLIENT_SECRET");
  const ACTNOW_URL = server.env("ACTNOW_URL");

  async function createAccount(user) {
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Token ${ACTNOW_API_KEY}`,
    });
    const response = await fetch(`${ACTNOW_URL}/v1/accounts/`, {
      method: "POST",
      headers,
      body: JSON.stringify(user),
    });
    return response.json();
  }

  async function fetchToken(url, params) {
    const Authorization = `Basic ${Buffer.from(
      `${ACTNOW_CLIENT_ID}:${ACTNOW_CLIENT_SECRET}`
    ).toString("base64")}`;
    const body = new URLSearchParams({
      grant_type: "password",
      ...params,
    }).toString();
    const options = {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "cache-control": "no-cache",
        Authorization,
      },
      body,
      redirect: "follow",
    };

    return fetch(url, options).then((response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error(response.statusText);
    });
  }

  async function loginUser(credentials) {
    const url = new URL("/o/token/", ACTNOW_URL).toString();
    const user = await fetchToken(url, credentials);
    if (user.error) {
      throw new Error(user.error);
    }
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      ...others
    } = user;
    return { accessToken, refreshToken, ...others };
  }

  async function refreshLoggedInUser({ refreshToken: currentRefreshToken }) {
    const params = {
      refresh_token: currentRefreshToken,
      grant_type: "refresh_token",
    };
    const url = new URL("/o/token/", ACTNOW_URL).toString();
    try {
      const {
        access_token: accessToken,
        refresh_token: refreshToken,
        ...others
      } = await fetchToken(url, params);
      return {
        ...others,
        accessToken,
        exp: jwtDecode(accessToken).exp,
        // Fall back to current refresh token if new one is not available
        refreshToken,
      };
    } catch (error) {
      return null;
    }
  }

  async function updateLoggeduser(user) {
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIiwiZXhwIjoxNjQ4NzYxMjIzLCJhdWQiOiJjc01MbTZmTjRXVDJZckhrMjRyN0RlaDBVRmlpSmJLUzVrNG83TFBwIiwiaXNzIjoiYWN0Tk9XIiwic3ViIjoxOH0.vP5qxBe7trLKvbpCXqlrQoff6qveAGT-vxZkhjcjhbMPzpBE_qbymDWaNwyfqC71Si86JD-hloEXAf1JEZw2P8u8b4nUr5oj63as9PNW3IENXp6YFdWec8m-IY8rmc_vzw7W7DH0Jf2qcMPjZQHMGtkCRsX1tt6JJ8RFJhAdDpLIyaR-KSrfFI5mtlmP1gcKEQtOfVz3Auyqs4lEOebnFOx4rQ6rL2hwgGAn11Gk26s_qz1kcF5Eb3qH3mqoTch5hDs-l1zEYk6h8Gm3EvxrLMhwap_jRV75j5w339KrUexmtbGTLxEugSTM6Lt1mg98o8ocIW2D3sL9Pz0szMMm8d7admL67xRQYeIXw4Dcs9n8nNPcyo-M6hNDFzD5TM10GM83uF_WEpc-5UijLtfZx7ztSpWyr2-unZ9L0Obda3cc48N73lR-lQM1FPmRkA876kLUSLzsckhJiKlXRhITzWRZ7cwEBCm4tgd3_AKAXxCr64xVX0BQqLgxbdNDRVMooZmS5NgUbfWKHLNzPk1GU6MPwuSyonVnd2mS9P3SxSHgM2Qn6xHNcCx-lSkAbOeAjxenwb4JH38msr1PAHedexmdSb2zmnQX2F51wSBOzG0EcCFsl4h58qoLVKf-WzLc5ZWTGV2NQySEfp9u5PpjxEZ-IwaAxa5XizxWF9qMQ4s`,
    });

    const response = await fetch(
      `${ACTNOW_URL}/v1/profiles/users/${user?.profile?.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(user),
      }
    );
    return response.json();
  }

  async function getPetitions(query) {
    const url = `${ACTNOW_URL}/v1/petitions/?${`${query}&` || ""}format=json`;
    const response = await fetch(url);
    const petitions = response.ok ? await response.json() : [];

    // TODO(kilemensi): Remove hard-coded status once implemented in actNOW
    return petitions?.map((petition) => ({ ...petition, status: "closed" }));
  }

  async function getPetition(id) {
    const url = `${ACTNOW_URL}/v1/petitions/${id}/?format=json`;
    const response = await fetch(url);
    const petition = (await response.json()) || [];

    return petition;
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
        refresh: (token) => {
          return (async () => {
            return refreshLoggedInUser(token);
          })();
        },
        update: (user) => {
          return (async () => {
            return updateLoggeduser(user);
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
    petition: (id) => {
      return {
        get lists() {
          return (async () => {
            return getPetition(id);
          })();
        },
      };
    },
  };

  return api;
}

export default actnow;
