import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECK_NOW_MESSAGE, isCheckNowRequest } from "./messages.js";

test("isCheckNowRequest accepts a well-formed CHECK_NOW message", () => {
  assert.equal(isCheckNowRequest({ type: CHECK_NOW_MESSAGE }), true);
});

test("isCheckNowRequest rejects other message shapes", () => {
  assert.equal(isCheckNowRequest({ type: "SOMETHING_ELSE" }), false);
  assert.equal(isCheckNowRequest(null), false);
  assert.equal(isCheckNowRequest(undefined), false);
  assert.equal(isCheckNowRequest("CHECK_NOW"), false);
  assert.equal(isCheckNowRequest(42), false);
});
