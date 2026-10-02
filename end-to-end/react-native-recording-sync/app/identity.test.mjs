import { test } from "node:test";
import assert from "node:assert/strict";
import { connectVerified, verifyPaired } from "./identity.ts";
test("uses post-connect identity and disconnects mismatches", async () => {
  let disconnected = 0;
  const manager = {
    connect: async () => ({ serialNumber: "actual" }),
    disconnect: async () => {
      disconnected++;
    },
  };
  await assert.rejects(
    connectVerified(manager, { name: "expected" }, "expected"),
    /does not match/,
  );
  assert.equal(disconnected, 1);
  assert.equal(
    (await connectVerified(manager, {}, "actual")).serialNumber,
    "actual",
  );
  await assert.rejects(connectVerified(manager, {}, " "), /Enter the serial/);
});

test("fresh pairing read admits a verified device despite beta.10's false snapshot", async () => {
  const calls = [];
  const device = { serialNumber: "actual", isProvisioned: false };
  const access = {
    connect: async () => { calls.push("connect"); return device; },
    isProvisioned: async selected => {
      assert.equal(selected, device);
      calls.push("fresh pairing read");
      return true;
    },
    disconnect: async () => { calls.push("disconnect"); },
  };
  const connected = await connectVerified(access, {}, "actual");
  assert.equal(await verifyPaired(access, connected, () => true, () => calls.push("blocked")), true);
  assert.deepEqual(calls, ["connect", "fresh pairing read"]);
  assert.equal(device.isProvisioned, false);
});

for (const outcome of ["false", "error"]) {
  test(`fresh pairing ${outcome} blocks access before disconnect and never admits work`, async () => {
    const calls = [];
    const admitted = await verifyPaired({
      isProvisioned: async () => {
        if (outcome === "error") throw new Error("private native context");
        return false;
      },
      disconnect: async () => { calls.push("disconnect"); },
    }, { isProvisioned: true }, () => true, () => calls.push("blocked"));
    if (admitted) calls.push("catalog or upload");
    assert.deepEqual(calls, ["blocked", "disconnect"]);
  });
}

for (const result of [true, false]) {
  test(`late pairing ${result} cannot admit or clean up a retired operation`, async () => {
    let resolve;
    let current = true;
    const pending = new Promise(done => { resolve = done; });
    const calls = [];
    const checked = verifyPaired({
      isProvisioned: () => pending,
      disconnect: async () => calls.push("disconnect"),
    }, {}, () => current, () => calls.push("blocked"));
    current = false;
    resolve(result);
    assert.equal(await checked, false);
    assert.deepEqual(calls, []);
  });
}

test("failed disconnect cannot turn rejected pairing into admission", async () => {
  let blocked = false;
  assert.equal(await verifyPaired({
    isProvisioned: async () => false,
    disconnect: async () => { throw new Error("transport failed"); },
  }, {}, () => true, () => { blocked = true; }), false);
  assert.equal(blocked, true);
});
