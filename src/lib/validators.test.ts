import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidDiscordWebhook,
  isValidSlackWebhook,
  isValidTelegramBotToken,
  isValidTelegramChatId,
  isValidThreshold,
  isValidBackendUrl,
} from "./validators.js";

test("isValidDiscordWebhook accepts a real-shaped webhook URL", () => {
  assert.equal(
    isValidDiscordWebhook("https://discord.com/api/webhooks/123456789012345678/AbCdEf-token_123"),
    true
  );
});

test("isValidDiscordWebhook rejects unrelated URLs", () => {
  assert.equal(isValidDiscordWebhook("https://example.com/not-a-webhook"), false);
  assert.equal(isValidDiscordWebhook(""), false);
});

test("isValidSlackWebhook accepts a real-shaped webhook URL", () => {
  assert.equal(
    isValidSlackWebhook("https://hooks.slack.com/services/T000/B000/xxxxxxxxxxxxxxxxxxxxxxxx"),
    true
  );
});

test("isValidSlackWebhook rejects an incomplete URL", () => {
  assert.equal(isValidSlackWebhook("https://hooks.slack.com/"), false);
});

test("isValidTelegramBotToken accepts a BotFather-style token", () => {
  assert.equal(isValidTelegramBotToken("123456789:AAxxxxxxxxxxxxxxxxxxxxxx"), true);
});

test("isValidTelegramBotToken rejects garbage", () => {
  assert.equal(isValidTelegramBotToken("not-a-token"), false);
});

test("isValidTelegramChatId accepts positive and negative numeric ids", () => {
  assert.equal(isValidTelegramChatId("123456789"), true);
  assert.equal(isValidTelegramChatId("-100123456789"), true);
});

test("isValidTelegramChatId rejects non-numeric ids", () => {
  assert.equal(isValidTelegramChatId("abc123"), false);
});

test("isValidThreshold accepts 1-100 and rejects out-of-range or non-numeric input", () => {
  assert.equal(isValidThreshold("1"), true);
  assert.equal(isValidThreshold("100"), true);
  assert.equal(isValidThreshold("80"), true);
  assert.equal(isValidThreshold("0"), false);
  assert.equal(isValidThreshold("101"), false);
  assert.equal(isValidThreshold(""), false);
  assert.equal(isValidThreshold("abc"), false);
});

test("isValidBackendUrl accepts http/https URLs, including LAN addresses with a port", () => {
  assert.equal(isValidBackendUrl("http://192.168.1.50:3000"), true);
  assert.equal(isValidBackendUrl("https://usage.example.com"), true);
});

test("isValidBackendUrl rejects non-URLs and non-http(s) schemes", () => {
  assert.equal(isValidBackendUrl("not a url"), false);
  assert.equal(isValidBackendUrl("ftp://192.168.1.50"), false);
  assert.equal(isValidBackendUrl(""), false);
});
