# RFC 1

- Feature Name: Add multiple promise sources as a service
- Start Date: 2021-07-28

# Summary

[summary]: #summary

Support promises from different sources. This can be a gSheet, Check platform, SourceFabric, JSON file, etc.

A single PromiseTracker instance will choose which source to use (but only 1 source at a time).

# Motivation

[motivation]: #motivation

As of now, we can only pull promises from the **check platform**. However, the platform keeps on changing their API and thus we need to keep updating our code. We would like to be able to use other promise sources which will make it fast for individual PromiseTracker instances to be spun up without having to rely on the check platform.

# Guide-level explanation

[guide-level-explanation]: #guide-level-explanation

The first step will be to create a Structure that all promises should follow. A promise will be expected to have the following fields

- promise_id
- title
- description
- status
- created_at
- updated_at
- extras({....})

We will then create an application that accepts api requests e.g

```
GET /promises?from=google_sheet
GET /promises?from=check
```

The application will have all the configuration variables for all sources we want to get promises from and depending on the incoming request query parameter, pick the correct **service** to process the request.

# Reference-level explanation

[reference-level-explanation]: #reference-level-explanation

We will create an independent application (language agnostic) that has access to different services either running in the app or running independently. The services will include

1. A service for connecting to googlesheet and getting promises
2. A service that pulls promises from a json file and forwards them to the app for processing
3. A service that pulls promises from the _Check_ platform.

```
promises_sources = [{"GOOGLE": google_service}, {"JSON": json_service}, {"CHECK": check_service}]
response = promises_sources[request.query['from']]

```

# Drawbacks

[drawbacks]: #drawbacks

1. The process of deploying a PromiseTracker will be more complicated since users will have to deploy both services. Unless we find a way to be the only backend service provider and then users will have to add credentials e.g Google credentials through a dashboard (same way as Debunkbot)
2. Will take long to fully develop and 2 different codebases to maintain

# Rationale and alternatives

[rationale-and-alternatives]: #rationale-and-alternatives

- Why is this design the best in the space of possible designs?

  > 1. Adding new sources will be easier as the users will just have to update a config variable without having to re download new package.

- What other designs have been considered and what is the rationale for not choosing them?

# Prior art

# Unresolved questions

# Future possibilities
