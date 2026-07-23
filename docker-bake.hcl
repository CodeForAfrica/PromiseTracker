# Docker Bake definition for the Promise Tracker images.
#
# Single source of truth for how the immutable runtime and migrator images are
# built. Used by .github/workflows/build-image.yml (CI) and reproducible
# locally with `docker buildx bake`.
#
# The two targets are built on separate NATIVE runners rather than via QEMU
# emulation (see the workflow), which is what makes CI fast:
#   - runtime  -> linux/arm64 (deployed to the arm64 Dokku host)
#   - migrator -> linux/amd64 (only ever `docker run` on the amd64 GH runner)

variable "IMAGE_NAME" {
  default = "codeforafrica/promisetracker-v2"
}

# Image tag (usually the git SHA). "local" is the dev default.
variable "TAG" {
  default = "local"
}

# Public, build-time-inlined Next.js config. Safe to appear in logs.
variable "NEXT_PUBLIC_APP_URL" {
  default = "http://localhost:3000"
}

variable "NEXT_PUBLIC_SENTRY_DSN" {
  default = ""
}

variable "SENTRY_ENVIRONMENT" {
  default = "development"
}

# `docker buildx bake` with no target builds both.
group "default" {
  targets = ["runtime", "migrator"]
}

# Production runtime image (slim standalone Next.js server + Tika).
target "runtime" {
  context    = "."
  dockerfile = "Dockerfile"
  target     = "runner"
  tags       = ["${IMAGE_NAME}:${TAG}"]
  args = {
    NEXT_PUBLIC_APP_URL    = "${NEXT_PUBLIC_APP_URL}"
    NEXT_PUBLIC_SENTRY_DSN = "${NEXT_PUBLIC_SENTRY_DSN}"
    SENTRY_ENVIRONMENT     = "${SENTRY_ENVIRONMENT}"
  }
  # Sentry source-map upload credentials — never inlined into the image layers.
  secret = [
    "type=env,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN",
    "type=env,id=sentry_org,env=SENTRY_ORG",
    "type=env,id=sentry_project,env=SENTRY_PROJECT",
  ]
}

# Migrator image: retains the Payload CLI + migrations/ to run `payload migrate`
# exactly once during a release. No app build, no Tika/JRE — fast to build.
target "migrator" {
  context    = "."
  dockerfile = "Dockerfile"
  target     = "migrator"
  tags       = ["${IMAGE_NAME}-migrator:${TAG}"]
}
