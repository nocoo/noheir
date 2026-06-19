#!/usr/bin/env bash
# Supply-chain pin assertions for noheir GHA workflows.
# Invoked from .github/workflows/ci.yml release-smoke job.
#
# Kept outside .github/workflows/ so that acceptance greps over the
# workflows directory (e.g. `grep -rE appleboy .github/workflows/`)
# stay clean and only match real workflow references, not assertion
# patterns.
set -euo pipefail

WF_DIR=".github/workflows"
RELEASE="${WF_DIR}/release.yml"

# String literals are assembled at runtime so this script can itself live
# anywhere without re-triggering the same audit it performs.
THIRD_PARTY_SSH="appleboy""/ssh-action"
INHOUSE_SSH="nocoo/base-ci/.github/actions/ssh-deploy"
BASE_CI_PREFIX="nocoo/base-ci"

if grep -q "${THIRD_PARTY_SSH}" "${RELEASE}"; then
  echo "::error::${RELEASE} still references the third-party ssh action"
  exit 1
fi

if ! grep -qE "${INHOUSE_SSH}@[a-f0-9]{40}" "${RELEASE}"; then
  echo "::error::ssh-deploy must be pinned to a 40-char commit SHA"
  exit 1
fi
echo "OK: ssh-deploy SHA-pinned, no third-party ssh action reference"

if grep -rE "${BASE_CI_PREFIX}.*@v[0-9]" "${WF_DIR}/"; then
  echo "::error::Found floating tag reference under ${WF_DIR}/"
  exit 1
fi
echo "OK: all base-ci references SHA-pinned"
