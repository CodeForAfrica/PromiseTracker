export default () => {
  const reserved = ["promisetracker"];
  let hostname = window.location.hostname.toLowerCase();
  hostname = hostname.replace("-staging", "");
  const hostnameSections = hostname.split(".");
  const first = hostnameSections[0];
  if (reserved.includes(first)) {
    return hostnameSections[1];
  }
  return first;
};
