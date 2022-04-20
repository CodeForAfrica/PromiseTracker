import { getSession } from "next-auth/react";

import actnow from "@/promisetracker/lib/actnow";

async function getUserInformation(req, res) {
  try {
    const results = await actnow().accounts().getUserDetails();
    return res.status(201).json(results);
  } catch (error) {
    return res.status(500).json(error);
  }
}

async function updateUserInformation(req, res) {
  const session = await getSession({ req });
  try {
    const results = await actnow()
      .accounts()
      .updateUserDetails(req?.body, session);
    return res.status(201).json(results);
  } catch (error) {
    return res.status(500).json(error);
  }
}

async function handleAccounts(req, res) {
  if (req.method === "GET") {
    return getUserInformation(req, res);
  }
  if (req.method === "PATCH") {
    return updateUserInformation(req, res);
  }
  return res.status(403).json();
}

export default handleAccounts;
