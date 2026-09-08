import assert from "node:assert/strict";
import test from "node:test";
import { GatewayAdapter, readAttachmentPolicy } from "../../apps/desktop/electron/gateway-adapter.mjs";
import { SetupChannel } from "../../apps/desktop/electron/setup-channel.mjs";

for (const [name, Channel, method] of [
  ["chat", GatewayAdapter, "health"],
  ["setup", SetupChannel, "openclaw.setup.detect"]
]) {
  test(`${name} rejects pre-handshake requests and ignores a retired client's callbacks`, async () => {
    const clients = [];
    const statuses = [];
    const events = [];
    class FakeClient {
      constructor(options) { this.options = options; this.calls = []; clients.push(this); }
      start() {}
      async stopAndWait() {}
      async request(...args) { this.calls.push(args); return { ok: true }; }
    }
    const channel = new Channel({
      stateDirectory: "/unused-synthetic-state",
      Client: FakeClient,
      identityLoader: () => ({ deviceId: "synthetic-device" }),
      onStatus: (status) => statuses.push(status),
      onEvent: (event) => events.push(event)
    });
    channel.connect({ url: "ws://127.0.0.1:43123", token: "synthetic" });
    const first = clients[0];
    await assert.rejects(channel.request(method, {}), /not connected/);
    assert.equal(first.calls.length, 0);
    first.options.onHelloOk({ protocol: 4, server: { version: "synthetic" }, auth: { scopes: ["synthetic"] },
      policy: { attachments: { maxBytes: 2000, maxImageBytes: 1000 }, maxPayload: 4000 } });
    if (name === "chat") assert.deepEqual(statuses.at(-1).attachmentPolicy, { maxBytes: 2000, maxImageBytes: 1000, maxPayload: 4000 });
    assert.equal(channel.connected, true);
    assert.deepEqual(await channel.request(method, {}), { ok: true });
    await channel.disconnect();
    assert.equal(channel.connected, false);
    if (name === "chat") assert.equal(channel.hello, null);
    else assert.deepEqual(channel.grantedScopes, []);

    channel.connect({ url: "ws://127.0.0.1:43124", token: "synthetic-new" });
    const second = clients[1];
    first.options.onHelloOk({ protocol: 999 });
    assert.equal(channel.connected, false, "stale hello cannot mark the new connection ready");
    second.options.onHelloOk({ protocol: 4, server: { version: "current" }, auth: { scopes: ["current"] } });
    if (name === "chat") assert.equal(statuses.at(-1).attachmentPolicy, null, "reconnect cannot inherit a previous server's limits");
    const statusCount = statuses.length;
    first.options.onClose(1006, "stale close");
    first.options.onConnectError(new Error("stale error"));
    first.options.onEvent?.({ event: "chat", payload: { text: "stale" } });
    assert.equal(channel.connected, true);
    assert.equal(statuses.length, statusCount);
    assert.equal(events.length, 0);
    if (name === "chat") assert.equal(channel.hello.server.version, "current");
    else assert.deepEqual(channel.grantedScopes, ["current"]);

    second.options.onClose(1006, "current close");
    assert.equal(channel.connected, false);
    if (name === "chat") assert.equal(channel.hello, null);
    else assert.deepEqual(channel.grantedScopes, []);
    await assert.rejects(channel.request(method, {}), /not connected/);
    assert.equal(second.calls.length, 0);
    await channel.disconnect();
  });
}

test("attachment policy exposes only finite negotiated limits and fails closed if any are absent", () => {
  assert.deepEqual(readAttachmentPolicy({ private: "not forwarded", policy: { attachments: { maxBytes: 20, maxImageBytes: 10, extra: true }, maxPayload: 40 } }),
    { maxBytes: 20, maxImageBytes: 10, maxPayload: 40 });
  for (const value of [undefined, 0, -1, 1.5, "20", Infinity]) {
    assert.equal(readAttachmentPolicy({ policy: { attachments: { maxBytes: value, maxImageBytes: 10 }, maxPayload: 40 } }), null);
  }
});
