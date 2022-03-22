import actnow from "@/promisetracker/lib/actnow";

async function updateUserDetails(req, res) {
  try {
    const account = await actnow().accounts().update(req.body);
    return res.status(201).json(account);
  } catch (error) {
    return res.status(500).json(error);
  }
}

async function updateAccount(req, res) {
  if (req.method === "PATCH") {
    return updateUserDetails(req, res);
  }
  return res.status(403).json();
}

export default updateAccount;
