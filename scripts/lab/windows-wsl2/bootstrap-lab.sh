#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly NODE_VERSION="24.19.0"
readonly NODE_ARCHIVE="node-v${NODE_VERSION}-linux-x64.tar.xz"
readonly NODE_SHA256="14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647"
readonly NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}"
readonly PNPM_VERSION="11.2.2"
readonly OPENCLAW_VERSION="2026.7.1-2"
readonly LAB_USER="aifblab"
readonly LAB_GROUP="aifblab"
readonly LAB_ROOT="/opt/ai-for-boss-lab"
readonly LAB_STATE="/var/lib/ai-for-boss-lab"
readonly NODE_ROOT="${LAB_ROOT}/toolchain/node-v${NODE_VERSION}-linux-x64"
readonly PNPM_ROOT="${LAB_ROOT}/toolchain/pnpm-${PNPM_VERSION}"
readonly RUNTIME_ROOT="${LAB_ROOT}/runtime"
readonly INPUT_ROOT="/root/ai-for-boss-lab-input"
readonly LAB_PATH="${NODE_ROOT}/bin:${PNPM_ROOT}/bin:/usr/sbin:/usr/bin:/sbin:/bin"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "bootstrap-lab.sh must run as root" >&2
  exit 77
fi

if findmnt --mountpoint /mnt/c >/dev/null 2>&1; then
  echo "Host drive /mnt/c is visible; refusing to install runtime" >&2
  exit 78
fi

if command -v cmd.exe >/dev/null 2>&1; then
  echo "Windows interop is enabled; refusing to install runtime" >&2
  exit 78
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install --yes --no-install-recommends \
  build-essential \
  ca-certificates \
  curl \
  jq \
  pkg-config \
  python3 \
  util-linux \
  xz-utils

if ! getent group "${LAB_GROUP}" >/dev/null; then
  groupadd --system "${LAB_GROUP}"
fi

if ! id "${LAB_USER}" >/dev/null 2>&1; then
  useradd --create-home --gid "${LAB_GROUP}" --shell /bin/bash "${LAB_USER}"
fi

install -d -m 0755 "${LAB_ROOT}" "${LAB_ROOT}/toolchain"
install -d -m 0750 -o "${LAB_USER}" -g "${LAB_GROUP}" "${RUNTIME_ROOT}"
install -d -m 0750 -o "${LAB_USER}" -g "${LAB_GROUP}" "${LAB_STATE}" "${LAB_STATE}/state"
install -d -m 0755 "${LAB_STATE}/evidence"

if [[ ! -x "${NODE_ROOT}/bin/node" ]]; then
  archive_path="/tmp/${NODE_ARCHIVE}"
  curl --fail --location --proto '=https' --tlsv1.2 --output "${archive_path}" "${NODE_URL}"
  printf '%s  %s\n' "${NODE_SHA256}" "${archive_path}" | sha256sum --check --strict
  tar --extract --xz --file "${archive_path}" --directory "${LAB_ROOT}/toolchain"
  rm --force "${archive_path}"
fi

if [[ "$("${NODE_ROOT}/bin/node" --version)" != "v${NODE_VERSION}" ]]; then
  echo "Pinned Node version check failed" >&2
  exit 65
fi

if [[ ! -x "${PNPM_ROOT}/bin/pnpm" ]]; then
  PATH="${LAB_PATH}" "${NODE_ROOT}/bin/npm" install --global --prefix "${PNPM_ROOT}" "pnpm@${PNPM_VERSION}"
fi

chmod --recursive a+rX "${NODE_ROOT}" "${PNPM_ROOT}"

if [[ "$(PATH="${LAB_PATH}" "${PNPM_ROOT}/bin/pnpm" --version)" != "${PNPM_VERSION}" ]]; then
  echo "Pinned pnpm version check failed" >&2
  exit 65
fi

for input_name in package.json pnpm-workspace.yaml pnpm-lock.yaml; do
  if [[ ! -s "${INPUT_ROOT}/${input_name}" ]]; then
    echo "Pinned runtime input is missing: ${input_name}" >&2
    exit 66
  fi
  install -m 0640 -o "${LAB_USER}" -g "${LAB_GROUP}" "${INPUT_ROOT}/${input_name}" "${RUNTIME_ROOT}/${input_name}"
done

runuser -u "${LAB_USER}" -- env -i \
  HOME="/home/${LAB_USER}" \
  PATH="${LAB_PATH}" \
  PNPM_HOME="${PNPM_ROOT}/bin" \
  pnpm --dir "${RUNTIME_ROOT}" install --frozen-lockfile

runuser -u "${LAB_USER}" -- env -i \
  HOME="/home/${LAB_USER}" \
  PATH="${LAB_PATH}" \
  PNPM_HOME="${PNPM_ROOT}/bin" \
  pnpm --dir "${RUNTIME_ROOT}" rebuild --pending

package_version="$(runuser -u "${LAB_USER}" -- env -i PATH="${LAB_PATH}" "${NODE_ROOT}/bin/node" --eval "console.log(require('${RUNTIME_ROOT}/node_modules/openclaw/package.json').version)")"
if [[ "${package_version}" != "${OPENCLAW_VERSION}" ]]; then
  echo "Installed OpenClaw package version mismatch: ${package_version}" >&2
  exit 65
fi

run_smoke() {
  unshare --net -- runuser -u "${LAB_USER}" -- env -i \
    HOME="/home/${LAB_USER}" \
    LANG="C.UTF-8" \
    PATH="${LAB_PATH}" \
    OPENCLAW_CONFIG_PATH="${LAB_STATE}/state/openclaw.json" \
    OPENCLAW_DISABLE_BONJOUR="1" \
    OPENCLAW_EXEC_SHELL_SNAPSHOT="0" \
    OPENCLAW_NO_RESPAWN="1" \
    OPENCLAW_STATE_DIR="${LAB_STATE}/state" \
    "${RUNTIME_ROOT}/node_modules/.bin/openclaw" "$@"
}

cli_version="$(run_smoke --version)"
run_smoke --help >/dev/null
run_smoke gateway --help >/dev/null

runuser -u "${LAB_USER}" -- env -i \
  HOME="/home/${LAB_USER}" \
  PATH="${LAB_PATH}" \
  PNPM_HOME="${PNPM_ROOT}/bin" \
  pnpm --dir "${RUNTIME_ROOT}" licenses list --json >"${LAB_STATE}/evidence/licenses.full.json"

runuser -u "${LAB_USER}" -- env -i \
  HOME="/home/${LAB_USER}" \
  PATH="${LAB_PATH}" \
  PNPM_HOME="${PNPM_ROOT}/bin" \
  pnpm --dir "${RUNTIME_ROOT}" list --json --depth Infinity >"${LAB_STATE}/evidence/dependency-tree.full.json"

rm --force "${LAB_STATE}/evidence/sbom.full.cdx.json"

jq --null-input \
  --arg generatedAt "$(date --utc +%Y-%m-%dT%H:%M:%SZ)" \
  --arg distro "AIForBossLab" \
  --arg nodeVersion "v${NODE_VERSION}" \
  --arg pnpmVersion "${PNPM_VERSION}" \
  --arg openclawPackageVersion "${package_version}" \
  --arg openclawCliVersion "${cli_version}" \
  '{
    schemaVersion: "1.0.0",
    generatedAt: $generatedAt,
    lab: $distro,
    containment: {
      windowsDriveMounted: false,
      windowsInteropEnabled: false,
      smokeNetworkNamespace: "isolated-no-network"
    },
    versions: {
      node: $nodeVersion,
      pnpm: $pnpmVersion,
      openclawPackage: $openclawPackageVersion,
      openclawCli: $openclawCliVersion
    },
    checks: {
      openclawVersion: "pass",
      openclawHelp: "pass",
      gatewayHelp: "pass",
      dependencyTreeGenerated: "pass",
      baselineCycloneDxSbom: "repo-artifact",
      transitiveLicenseInventoryGenerated: "pass"
    },
    limitations: [
      "No provider authentication or model call was performed.",
      "Gateway help was checked; Gateway RPC readiness was not tested.",
      "This WSL2 lab is not a product sandbox decision."
    ]
  }' >"${LAB_STATE}/evidence/smoke-report.json"

chmod 0644 "${LAB_STATE}/evidence/"*.json

echo "AI for Boss lab bootstrap and no-network smoke test passed."
