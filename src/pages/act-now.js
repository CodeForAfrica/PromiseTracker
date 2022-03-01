import { useSession } from "next-auth/react";
import React, { useEffect } from "react";

import ActNowPage from "@/promisetracker/components/ActNowPage";
import ActNowLoggedInPage from "@/promisetracker/components/ActNowPage/LoggedIn";
import actnow from "@/promisetracker/lib/actnow";
import backendFn from "@/promisetracker/lib/backend";
import i18n from "@/promisetracker/lib/i18n";
import wp from "@/promisetracker/lib/wp";

function ActNow({ ...props }) {
  const { data: session, status } = useSession();
  const [signedPetitions, setSignedPetitions] = React.useState([]);
  const [ownedPetitions, setOwnedPetitions] = React.useState([]);

  useEffect(() => {
    if (session) {
      actnow()
        .petitions(
          new URLSearchParams({
            individual_signatories: session?.user?.profile?.id,
          }).toString()
        )
        .list.then((res) => setSignedPetitions(res));
      actnow()
        .petitions(
          new URLSearchParams({ owner: session?.user?.profile?.id }).toString()
        )
        .list.then((res) => setOwnedPetitions(res));
    }
  }, [session]);

  // When rendering client side don't display anything until loading is complete
  if (typeof window !== "undefined" && status === "loading") return null;

  // If no session exists, show default landing page
  if (!session) {
    return <ActNowPage {...props} />;
  }

  // If session exists, display logged in page
  return (
    <ActNowLoggedInPage
      signedPetitions={signedPetitions}
      ownedPetitions={ownedPetitions}
      {...props}
    />
  );
}

export async function getStaticProps({ locale }) {
  const _ = i18n();
  if (!_.locales.includes(locale)) {
    return {
      notFound: true,
    };
  }

  const backend = backendFn();
  const site = await backend.sites().current;
  if (!site.actNowEnabled) {
    return {
      notFound: true,
    };
  }

  const promises = await backend.promises().all;

  const page = await wp().pages({ slug: "act-now", locale }).first;
  const { actNow = {} } = page;
  const petitions = await actnow().petitions().list;

  const languageAlternates = _.languageAlternates("/act-now");
  actNow.url = process.env.ACTNOW_URL ?? null;

  const headers = new Headers({
    "Content-Type": "application/json",
    Authorization: `Token ${process.env.ACTNOW_API_KEY}`,
  });
  const actnowSummary = await fetch(`${actNow.url}/v1/`, {
    method: "GET",
    headers,
  }).then(async (response) => response.json());
  actNow.summary = actnowSummary?.summary;

  return {
    props: {
      ...page,
      ...site,
      actNow,
      languageAlternates,
      promises,
      petitions,
    },
  };
}

export default ActNow;
