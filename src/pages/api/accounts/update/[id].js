import { getSession } from "next-auth/react";

import actnow from "@/promisetracker/lib/actnow";

async function updateUserInformation(req, res) {
  const session = await getSession({ req });
  try {
    const results = await actnow()
      .accounts()
      .updateUserDetails(req?.body, session);
    return res.status(201).json(results);
  } catch (error) {
    console.log(error);
    return res.status(500).json(error);
  }
}

async function handleAccounts(req, res) {
  if (req.method === "PATCH") {
    return updateUserInformation(req, res);
  }
  return res.status(403).json();
}

export default handleAccounts;
