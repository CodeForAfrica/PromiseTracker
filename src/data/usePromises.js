import config from 'config';

import gql from 'graphql-tag';
import { useQuery } from '@apollo/react-hooks';

const GET_PROMISES = gql`
  query getPromises($query: String!, $limit: Int!) {
    search(query: $query) {
      medias(first: $limit) {
        edges {
          node {
            status
            tasks(first: 150) {
              edges {
                node {
                  id
                  label
                  first_response_value
                }
              }
            }
            tags {
              edges {
                node {
                  id
                  tag_text
                }
              }
            }
          }
        }
      }
    }
  }
`;

function usePromises(limit) {
  return useQuery(GET_PROMISES, {
    variables: {
      query: `{ "verification_status":["${config.CHECK_PROMISE_VERIFICATION_STATUS}"], "projects":["${config.CHECK_PROJECT_DB_ID}"] }`,
      limit: limit || config.CHECK_PROMISE_MAX_COUNT
    }
  });
}

export default usePromises;
