// A handshake alone does not prove the hidden renderer displayed the new state.
export async function waitForSmokeRendererReady({ readReady, runtimeReady, timeoutMs = 5_000, pollMs = 100 }) {
  let expired = false;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => { expired = true; resolve(false); }, timeoutMs);
  });
  const poll = async () => {
    while (!expired) {
      if (!runtimeReady()) return false;
      let ready;
      try { ready = await readReady(); } catch { return false; }
      if (expired) return false;
      if (ready === true && runtimeReady()) return true;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return false;
  };
  try { return await Promise.race([poll(), timeout]); }
  finally { expired = true; clearTimeout(timer); }
}
