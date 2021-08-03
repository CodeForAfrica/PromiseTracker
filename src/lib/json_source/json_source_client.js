import promises from "../../../public/promises.json";

const JsonSourceClient = () => {
  return {
    query({ query, limit, category, id }) {
      switch (query) {
        case "GET_PROMISES":
          return new Promise((resolve, reject) => {
            if (promises.promises === undefined) {
              reject(new Error("No promises defined"));
            }
            resolve(promises.promises.slice(0, limit));
          });
        case "GET_PROMISE":
          return new Promise((resolve, reject) => {
            try {
              const promise = promises.promises.filter(
                (p) => `${p.id}` === id
              )[0];
              return resolve(promise);
            } catch (e) {
              return reject(e);
            }
          });
        case "GET_PROMISES_BY_CATEGORY":
          return new Promise((resolve, reject) => {
            const promise = promises.promises.filter(
              (p) => p.category === category
            );
            if (promise.length > 0) {
              resolve(promise);
            } else {
              reject(new Error("No promises found"));
            }
          });
        default:
          return new Promise();
      }
    },
  };
};

export default JsonSourceClient;
