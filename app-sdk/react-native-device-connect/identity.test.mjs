import { test } from "node:test";
import assert from "node:assert/strict";
import { connectVerified } from "./identity.ts";
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
