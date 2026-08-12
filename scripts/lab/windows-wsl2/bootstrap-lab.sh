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

run_gateway_contract_smoke() {
  local gateway_token
  gateway_token="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"

  export LAB_USER RUNTIME_ROOT NODE_ROOT PNPM_ROOT
  export OPENCLAW_GATEWAY_TOKEN="${gateway_token}"
  unshare --net -- bash <<'GATEWAY_SMOKE'
set -Eeuo pipefail

ip link set lo up

lab_path="${NODE_ROOT}/bin:${PNPM_ROOT}/bin:/usr/sbin:/usr/bin:/sbin:/bin"
smoke_state="$(mktemp -d /tmp/aifb-gateway-state.XXXXXX)"
gateway_log="$(mktemp /tmp/aifb-gateway-log.XXXXXX)"
health_json="$(mktemp /tmp/aifb-gateway-health.XXXXXX)"
chown "${LAB_USER}:${LAB_USER}" "${smoke_state}" "${gateway_log}" "${health_json}"
port="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"

export HOME="/home/${LAB_USER}"
export LANG="C.UTF-8"
export PATH="${lab_path}"
export OPENCLAW_CONFIG_PATH="${smoke_state}/openclaw.json"
export OPENCLAW_DISABLE_BONJOUR="1"
export OPENCLAW_EXEC_SHELL_SNAPSHOT="0"
export OPENCLAW_NO_RESPAWN="1"
export OPENCLAW_STATE_DIR="${smoke_state}"

runuser --preserve-environment --user "${LAB_USER}" -- \
  "${RUNTIME_ROOT}/node_modules/.bin/openclaw" gateway \
  --allow-unconfigured \
  --auth token \
  --bind loopback \
  --port "${port}" \
  --ws-log compact \
  run >"${gateway_log}" 2>&1 &
gateway_pid=$!

cleanup_gateway_smoke() {
  kill "${gateway_pid}" 2>/dev/null || true
  wait "${gateway_pid}" 2>/dev/null || true
  unset OPENCLAW_GATEWAY_TOKEN
  rm -rf -- "${smoke_state}"
  rm -f -- "${gateway_log}" "${health_json}"
}
trap cleanup_gateway_smoke EXIT

port_ready=0
for _ in $(seq 1 50); do
  if python3 -c 'import socket,sys; s=socket.create_connection(("127.0.0.1", int(sys.argv[1])), 0.2); s.close()' "${port}" 2>/dev/null; then
    port_ready=1
    break
  fi
  if ! kill -0 "${gateway_pid}" 2>/dev/null; then
    cat "${gateway_log}" >&2
    exit 1
  fi
  sleep 0.1
done

if [[ "${port_ready}" -ne 1 ]]; then
  cat "${gateway_log}" >&2
  exit 1
fi

runuser --preserve-environment --user "${LAB_USER}" -- \
  "${RUNTIME_ROOT}/node_modules/.bin/openclaw" gateway health \
  --port "${port}" \
  --json \
  --timeout 10000 >"${health_json}"

python3 - "${health_json}" <<'PY'
import datetime
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    health = json.load(handle)

assert isinstance(health, dict)
assert health.get("ok") is True

print(json.dumps({
    "schemaVersion": "1.0.0",
    "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "transport": "websocket-text-json",
    "protocolVersion": 4,
    "network": "isolated-loopback-only",
    "auth": "ephemeral-memory-token",
    "gatewayStarted": "pass",
    "healthRpc": "pass",
    "healthKeys": sorted(health.keys())
}, ensure_ascii=False))
PY
GATEWAY_SMOKE

  unset gateway_token
}

cli_version="$(run_smoke --version)"
run_smoke --help >/dev/null
run_smoke gateway --help >/dev/null
run_gateway_contract_smoke >"${LAB_STATE}/evidence/gateway-contract-smoke.json"

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
      cliSmokeNetworkNamespace: "isolated-no-network",
      gatewaySmokeNetworkNamespace: "isolated-loopback-only"
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
      gatewayStart: "pass",
      gatewayHealthRpc: "pass",
      dependencyTreeGenerated: "pass",
      baselineCycloneDxSbom: "repo-artifact",
      transitiveLicenseInventoryGenerated: "pass"
    },
    limitations: [
      "No provider authentication or model call was performed.",
      "The health RPC used the OpenClaw CLI reference client; the AI for Boss Adapter is a later feature.",
      "This WSL2 lab is not a product sandbox decision."
    ]
  }' >"${LAB_STATE}/evidence/smoke-report.json"

chmod 0644 "${LAB_STATE}/evidence/"*.json

echo "AI for Boss lab bootstrap and no-network smoke test passed."
