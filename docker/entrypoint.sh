#!/bin/sh
# web:    serves the public site, the admin and the API.
# worker: the same server with PT_ROLE=worker, which also runs background jobs.
# Payload applies pending migrations when it starts, before either takes traffic.
set -e
case "${1:-web}" in
  web) exec node apps/site/server.js ;;
  worker) PT_ROLE=worker exec node apps/site/server.js ;;
  *) exec "$@" ;;
esac
