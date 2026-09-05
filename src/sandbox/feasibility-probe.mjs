import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROTECTED_CAPABILITIES = Object.freeze({
  productHostExec: false,
  elevatedExec: false,
  sensitiveBrowser: false,
  networkEgress: false,
  credentialUse: false
});

export function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function present(candidate, existsSync) {
  try {
    return existsSync(candidate);
  } catch {
    return false;
  }
}

function collectRuntimeHints(platform, existsSync, environment) {
  if (platform === "win32") {
    const windowsRoot = environment.WINDIR || environment.SystemRoot || "C:\\Windows";
    const allUsersDocker = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
    const perUserDocker = environment.LOCALAPPDATA
      ? path.join(environment.LOCALAPPDATA, "Programs", "Docker", "Docker", "Docker Desktop.exe")
      : null;
    const perUserDockerFallback = environment.LOCALAPPDATA
      ? path.join(environment.LOCALAPPDATA, "Programs", "DockerDesktop", "Docker Desktop.exe")
      : null;
    return {
      dockerDesktopExecutablePresent:
        present(allUsersDocker, existsSync)
        || (perUserDocker !== null && present(perUserDocker, existsSync))
        || (perUserDockerFallback !== null && present(perUserDockerFallback, existsSync)),
      opensshClientAtStandardPath: present(path.join(windowsRoot, "System32", "OpenSSH", "ssh.exe"), existsSync),
      windowsSandboxExecutablePresent: present(path.join(windowsRoot, "System32", "WindowsSandbox.exe"), existsSync),
      wslExecutablePresent: present(path.join(windowsRoot, "System32", "wsl.exe"), existsSync)
    };
  }

  if (platform === "darwin") {
    return {
      codesignPresent: present("/usr/bin/codesign", existsSync),
      dockerDesktopAppPresent: present("/Applications/Docker.app", existsSync),
      opensshClientAtStandardPath: present("/usr/bin/ssh", existsSync),
      sandboxExecPresent: present("/usr/bin/sandbox-exec", existsSync)
    };
  }

  if (platform === "linux") {
    return {
      cgroupV2Present: present("/sys/fs/cgroup/cgroup.controllers", existsSync),
      dockerCliAtStandardPath: present("/usr/bin/docker", existsSync),
      opensshClientAtStandardPath: present("/usr/bin/ssh", existsSync),
      unsharePresent: present("/usr/bin/unshare", existsSync),
      userNamespaceMetadataPresent: present("/proc/self/ns/user", existsSync)
    };
  }

  return null;
}

function exerciseTempFixture(fsApi, osTemp) {
  const tempFixture = {
    createdInsideOsTemp: false,
    pathContained: false,
    cleanupReauthorized: false,
    cleanupVerified: false
  };
  let tempRoot = null;
  let resolvedOsTemp = null;
  let resolvedRoot = null;
  let failureCode = null;

  try {
    resolvedOsTemp = fsApi.realpathSync(osTemp);
    tempRoot = fsApi.mkdtempSync(path.join(resolvedOsTemp, "aifb-sandbox-feasibility-"));
    const requestedRootInsideOsTemp = isPathInside(resolvedOsTemp, tempRoot);
    resolvedRoot = fsApi.realpathSync(tempRoot);
    tempFixture.createdInsideOsTemp = requestedRootInsideOsTemp && isPathInside(resolvedOsTemp, resolvedRoot);
    tempFixture.pathContained = tempFixture.createdInsideOsTemp;
    if (!tempFixture.pathContained) {
      failureCode = "path-boundary-failed";
    }
  } catch {
    failureCode = "fixture-operation-failed";
  } finally {
    if (tempRoot !== null && tempFixture.pathContained) {
      try {
        const cleanupRoot = fsApi.realpathSync(tempRoot);
        tempFixture.cleanupReauthorized = isPathInside(resolvedOsTemp, cleanupRoot)
          && path.resolve(cleanupRoot) === path.resolve(resolvedRoot);
        if (!tempFixture.cleanupReauthorized) {
          failureCode = "cleanup-boundary-failed";
        } else {
          fsApi.rmdirSync(cleanupRoot);
          tempFixture.cleanupVerified = !fsApi.existsSync(tempRoot);
        }
      } catch {
        failureCode = "cleanup-failed";
        tempFixture.cleanupVerified = false;
      }
    }
  }

  if (failureCode === null && !Object.values(tempFixture).every(Boolean)) {
    failureCode = "temp-boundary-failed";
  }
  return {
    ok: failureCode === null,
    code: failureCode ?? "probe-complete",
    tempFixture
  };
}

export function runSandboxFeasibilityProbe({
  platform = process.platform,
  architecture = process.arch,
  nodeVersion = process.versions.node,
  capturedAt = new Date().toISOString(),
  fsApi = fs,
  environment = process.env,
  osTemp = os.tmpdir()
} = {}) {
  const [nodeMajorText] = nodeVersion.split(".");
  const runtimeHints = collectRuntimeHints(platform, fsApi.existsSync.bind(fsApi), environment);
  const base = {
    schemaVersion: "1.0.0",
    testId: "TEST-SANDBOX-FEASIBILITY-PRESENCE",
    capturedAt,
    platform,
    architecture,
    nodeMajor: Number.parseInt(nodeMajorText, 10),
    releaseTrainId: "oc-2026.7.1-2-locked.1",
    claimsIsolation: false,
    promotionEligible: false,
    protectedCapabilities: { ...PROTECTED_CAPABILITIES }
  };

  if (runtimeHints === null) {
    return {
      ...base,
      ok: false,
      code: "unsupported-probe",
      evidenceLevel: "blocked-or-not-feasible",
      evidenceScopes: [],
      runtimeHints: {},
      tempFixture: null,
      limitations: ["This operating system is outside the Windows, macOS and Linux Feature 0.6 probe matrix."]
    };
  }

  const fixtureResult = exerciseTempFixture(fsApi, osTemp);
  return {
    ...base,
    ok: fixtureResult.ok,
    code: fixtureResult.code,
    evidenceLevel: "spike-tested",
    evidenceScopes: ["presence", "temp-containment"],
    runtimeHints,
    tempFixture: fixtureResult.tempFixture,
    failure: fixtureResult.ok ? null : {
      component: "temp-fixture",
      message: "The contained synthetic fixture probe failed closed."
    },
    limitations: [
      "Executable or OS primitive presence does not prove installation health, isolation, policy enforcement or user readiness.",
      "This probe does not start a process, container, VM, SSH session, browser or network request.",
      "This probe creates and removes one empty directory solely under the OS temporary directory."
    ]
  };
}
