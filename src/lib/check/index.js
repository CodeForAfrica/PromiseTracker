import {
  GET_PROMISES,
  GET_PROMISES_BY_CATEGORIES,
} from "@/promisetracker/lib/check/gql";

import config from "@/promisetracker/config";
import promiseImage from "@/promisetracker/assets/promise-thumb-01.png";
import createApolloClient from "./createApolloClient";

const UNSPECIFIED_TEAM = "unspecified";
const CLIENT_PER_TEAM = new Map();

function check(team = undefined, initialState = {}) {
  const clientTeam = team || UNSPECIFIED_TEAM;
  const existingClient = CLIENT_PER_TEAM.get(clientTeam);
  const client = existingClient || createApolloClient(initialState, team);
  if (!existingClient) {
    CLIENT_PER_TEAM.set(clientTeam, existingClient);
  }

  function findItemByNodeLabel(tasks, label) {
    return tasks.find((item) => item.node.label === label);
  }

  function findItemByTaskLabel(items, label) {
    return items.find((item) => item.node.task?.label === label);
  }

  function getAssetURL(filename, id) {
    return `${config.CHECK_ASSET_URI}/${id}/${filename.replace(/ /g, "_")}`;
  }

  function getImage(node) {
    const logs = node.log?.edges;
    const tasks = node.tasks?.edges;
    const imageLog = findItemByTaskLabel(
      logs,
      "What is the image related to the promise"
    );
    const imageTask = findItemByNodeLabel(
      tasks,
      "What is the image related to the promise"
    );
    const filename = imageTask.node.first_response_value;
    const annotationChanges = JSON.parse(imageLog.node.object_changes_json)
      .annotation_id;
    const id = annotationChanges ? annotationChanges[1] : null; // latest image ID
    return filename && id ? getAssetURL(filename, id) : promiseImage;
  }

  function getPromiseDate(node) {
    const items = node.tasks?.edges;
    const startDateTask = findItemByNodeLabel(
      items,
      "When was this promise made?"
    );
    return startDateTask
      ? startDateTask.node.first_response_value.split(" ").slice(0, 3).join(" ")
      : null;
  }

  function getStatus(node) {
    const logs = node.log?.edges;
    const statusLogs = logs.filter(
      (item) => item.node.task?.label === "What is the status of the promise?"
    );
    const defaultStatus = config.promiseStatuses.find(
      (status) => status.title === "Unrated"
    );
    const statuses = statusLogs
      .filter((statusLog, idx) => {
        const currentStatus = JSON.parse(statusLog.node.object_changes_json)
          .value[1].replace(/[^\w\s]/gi, "")
          .trim();
        const prevStatus =
          idx > 0
            ? JSON.parse(statusLogs[idx - 1]?.node.object_changes_json)
                .value[1].replace(/[^\w\s]/gi, "")
                .trim()
            : null;
        return prevStatus !== currentStatus;
      })
      .map((statusLog) => {
        const promiseStatus = config.promiseStatuses.find(
          (status) =>
            status.title ===
            JSON.parse(statusLog?.node.object_changes_json)
              .value[1].replace(/[^\w\s]/gi, "")
              .trim()
        );
        if (promiseStatus) {
          const timeStamp =
            statusLog.node?.task?.updated_at * 1000 || Date.now();
          promiseStatus.date = new Date(timeStamp).toDateString({
            dateStyle: "short",
          });
          promiseStatus.year =
            new Date(timeStamp).getFullYear() +
            (new Date(timeStamp).getMonth() + 1) / 12;
        }
        return promiseStatus || defaultStatus;
      });
    return statuses.length ? statuses : [defaultStatus];
  }

  function handlePromisesResult(res) {
    return res.data.search.medias.edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      image: getImage(node),
      description: node.description,
      date: getPromiseDate(node),
      status: getStatus(node).reverse()[0],
      statuses: getStatus(node),
    }));
  }

  function handlePromisesCategoryResults({ data }) {
    return {
      id: data.team.id,
      count: data.team.medias_count,
      name: data.team.name,
      categories: data.team.projects.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        count: node.medias_count,
        projects: node.project_medias.edges.map((promise) => promise.node),
      })),
    };
  }

  const api = {
    promises: async (variables) => {
      return client
        .query({ query: GET_PROMISES, variables })
        .then(handlePromisesResult);
    },
    promisesByCategories: async (variables) => {
      return client
        .query({ query: GET_PROMISES_BY_CATEGORIES, variables })
        .then(handlePromisesCategoryResults);
    },
  };
  return api;
}

export default check;
