# RFC 1

- Feature Name: Add multiple promise sources as libraries
- Start Date: 2021-07-27

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

We will then create libraries that calls the different sources and transforms the recieved data to our defined structure. i.e We will have the following libraries(not an exclusive list)

- google sheet library that pulls promises from a google sheet and converts the response to our structure
- check library that pulls promises from check platform(e.g using graphql) and does the conversion.
- a Json library that pulls promises from a json file
- others e.g a source fabric library

Once the libraries have been defined, we can have some configuration variables that sets which library to be used and all the configurations required for that library e.g API keys.

# Reference-level explanation

[reference-level-explanation]: #reference-level-explanation

Using _google sheet library_ as an example, a **PromiseTracker** instance will set the _PROMISES_SOURCE_environment variable to_GOOGLE_SHEET_.
**PromiseTracker** will then instantiate it like

```
promises_sources = [{"GOOGLE": google_lib}, {"JSON": json_lib}, {"CHECK": check_lib}]
api_provider = promises_sources[process.env.PROMISES_SOURCE]
// use api_provider to make all api requests
```

**NOTE**
We should define a single Interface that defines what every class that inherits it should implement. This will enable us to use the returned `api_provider` without worrying which library it came from.

## Promise Library Interface

```
class PromiseLibrary{
    function get_promises(){
        // Every library will implement it's own get_promises method
    }
    function get_single_promise(promise_id) {

    }
}
```

# Drawbacks

[drawbacks]: #drawbacks

1. Having all these libraries inside PromiseTracker will make the project huge
2. Incase one of the platforms we are using e.g check platform changes their APIs, then everyone will have to update the libraries inorder to get the new changes we will implement

# Rationale and alternatives

[rationale-and-alternatives]: #rationale-and-alternatives

- Why is this design the best in the space of possible designs?

  > 1. Individuals will be able to easily deploy their own PromiseTracker instances without having to deploy another extra service.

- What other designs have been considered and what is the rationale for not choosing them?
  > Running the libraries as a service. One reason why we might not use this is Users will have to deploy 2 systems inorder to fully use PromiseTracker

# Prior art

# Unresolved questions

# Future possibilities

Packaging the libralies and distributing them as npm packages.
