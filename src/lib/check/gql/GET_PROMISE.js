import gql from "graphql-tag";

export default gql`
  query getPromise($id: String!) {
    project_media(ids: $id) {
      id
      dbid
      title
      description
      status
      archived
      created_at
      tags {
        edges {
          node {
            id
            tag_text
          }
        }
      }
      tasks {
        edges {
          node {
            id
            dbid
            label
            first_response_value
          }
        }
      }
      log {
        edges {
          node {
            event_type
            object_changes_json
            task {
              label
              updated_at
            }
            created_at
          }
        }
      }
    }
  }
`;
