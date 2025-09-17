#!/bin/sh
set -eu

if [ "$#" -eq 0 ]; then
  set -- node server.js
fi

TIKA_ENABLED="${TIKA_ENABLED:-1}"
TIKA_PORT="${TIKA_PORT:-9998}"
TIKA_HOST="${TIKA_HOST:-0.0.0.0}"
TIKA_SERVER_JAR="${TIKA_SERVER_JAR:-/opt/tika/tika-server.jar}"
TIKA_STARTUP_TIMEOUT="${TIKA_STARTUP_TIMEOUT:-60}"
TIKA_HEALTH_PATH="${TIKA_HEALTH_PATH:-/tika}"
TIKA_HEALTH_URL="${TIKA_HEALTH_URL:-http://127.0.0.1:${TIKA_PORT}${TIKA_HEALTH_PATH}}"
TIKA_VERSION="${TIKA_VERSION:-unknown}"

TIKA_PID=""
NODE_PID=""
TIKA_MONITOR_PID=""

log() {
  echo "[entrypoint] $*"
}

terminate() {
  if [ -n "${TIKA_MONITOR_PID}" ] && kill -0 "${TIKA_MONITOR_PID}" 2>/dev/null; then
    kill -TERM "${TIKA_MONITOR_PID}" 2>/dev/null || true
  fi
  if [ -n "${NODE_PID}" ] && kill -0 "${NODE_PID}" 2>/dev/null; then
    log "Stopping application (pid ${NODE_PID})"
    kill -TERM "${NODE_PID}" 2>/dev/null || true
  fi
  if [ -n "${TIKA_PID}" ] && kill -0 "${TIKA_PID}" 2>/dev/null; then
    log "Stopping Apache Tika (pid ${TIKA_PID})"
    kill -TERM "${TIKA_PID}" 2>/dev/null || true
  fi
}

on_signal() {
  log "Received termination signal"
  terminate
}

trap on_signal INT TERM

start_tika() {
  if [ "${TIKA_ENABLED}" = "0" ]; then
    log "Apache Tika startup disabled via TIKA_ENABLED=0"
    return 0
  fi

  if ! command -v java >/dev/null 2>&1; then
    log "Java runtime not found, cannot start Apache Tika" >&2
    exit 1
  fi

  if [ ! -f "${TIKA_SERVER_JAR}" ]; then
    log "Apache Tika jar missing at ${TIKA_SERVER_JAR}" >&2
    exit 1
  fi

  log "Starting Apache Tika ${TIKA_VERSION} on ${TIKA_HOST}:${TIKA_PORT}"
  java -jar "${TIKA_SERVER_JAR}" --host "${TIKA_HOST}" --port "${TIKA_PORT}" >/proc/self/fd/1 2>&1 &
  TIKA_PID=$!
  log "Apache Tika started with pid ${TIKA_PID}"
}

wait_for_tika() {
  if [ "${TIKA_ENABLED}" = "0" ]; then
    return 0
  fi

  elapsed=0
  while [ "${elapsed}" -lt "${TIKA_STARTUP_TIMEOUT}" ]; do
    if ! kill -0 "${TIKA_PID}" 2>/dev/null; then
      log "Apache Tika exited before becoming ready" >&2
      exit 1
    fi

    if curl --silent --fail --max-time 2 "${TIKA_HEALTH_URL}" >/dev/null 2>&1; then
      log "Apache Tika is ready"
      return 0
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  log "Apache Tika did not become healthy within ${TIKA_STARTUP_TIMEOUT}s" >&2
  exit 1
}

monitor_tika() {
  if [ -z "${TIKA_PID}" ]; then
    return 0
  fi

  wait "${TIKA_PID}"
  exit_code=$?
  if [ "${exit_code}" -ne 0 ]; then
    log "Apache Tika exited unexpectedly with status ${exit_code}"
  else
    log "Apache Tika process exited"
  fi
  if [ -n "${NODE_PID}" ] && kill -0 "${NODE_PID}" 2>/dev/null; then
    log "Stopping application because Apache Tika is not running"
    kill -TERM "${NODE_PID}" 2>/dev/null || true
  fi
}

start_tika
wait_for_tika

"$@" &
NODE_PID=$!
log "Application started with pid ${NODE_PID}"

if [ "${TIKA_ENABLED}" != "0" ] && [ -n "${TIKA_PID}" ]; then
  monitor_tika &
  TIKA_MONITOR_PID=$!
fi

wait "${NODE_PID}"
NODE_STATUS=$?

terminate

if [ -n "${TIKA_PID}" ]; then
  wait "${TIKA_PID}" 2>/dev/null || true
fi

if [ -n "${TIKA_MONITOR_PID}" ]; then
  wait "${TIKA_MONITOR_PID}" 2>/dev/null || true
fi

exit "${NODE_STATUS}"
