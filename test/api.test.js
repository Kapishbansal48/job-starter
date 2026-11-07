import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../job-board-starter/server.js";

async function withServer(fn, savedPath) {
  const dir = await mkdtemp(join(tmpdir(), "api-"));
  const file = savedPath ?? join(dir, "saved.json");
  const server = createApp({ savedPath: file });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  const call = async (path, options = {}) => {
    const res = await fetch(base + path, options);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  try {
    await fn(call, file);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

const post = (body) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("GET /api/saved is an empty list at first", () =>
  withServer(async (call) => {
    assert.deepEqual(await call("/api/saved"), { status: 200, body: [] });
  }));

test("POST /api/saved saves a job and GET returns it", () =>
  withServer(async (call) => {
    const created = await call("/api/saved", post({ jobId: "j6" }));
    assert.equal(created.status, 201);
    assert.equal(created.body.company, "Orbit Logistics");
    const list = await call("/api/saved");
    assert.deepEqual(list.body.map((j) => j.id), ["j6"]);
  }));

test("saving the same job twice keeps one copy", () =>
  withServer(async (call) => {
    assert.equal((await call("/api/saved", post({ jobId: "j1" }))).status, 201);
    assert.equal((await call("/api/saved", post({ jobId: "j1" }))).status, 200);
    assert.equal((await call("/api/saved")).body.length, 1);
  }));

test("an unknown job id gets a clear 404 and saves nothing", () =>
  withServer(async (call) => {
    const res = await call("/api/saved", post({ jobId: "nope" }));
    assert.equal(res.status, 404);
    assert.match(res.body.error, /nope/);
    assert.deepEqual((await call("/api/saved")).body, []);
  }));

test("bad requests get a 400 with a message, not a crash", () =>
  withServer(async (call) => {
    for (const body of ["{ not json", "", "{}", { jobId: 5 }, { jobId: "" }, "null", "[]"]) {
      const res = await call("/api/saved", post(body));
      assert.equal(res.status, 400, `body ${JSON.stringify(body)}`);
      assert.ok(res.body.error);
    }
    assert.equal((await call("/api/jobs")).status, 200); 
  }));

test("a very large body is refused", () =>
  withServer(async (call) => {
    const res = await call("/api/saved", post({ jobId: "x".repeat(50_000) }));
    assert.equal(res.status, 413);
  }));

test("DELETE /api/saved/:jobId removes the job", () =>
  withServer(async (call) => {
    await call("/api/saved", post({ jobId: "j1" }));
    await call("/api/saved", post({ jobId: "j2" }));
    assert.equal((await call("/api/saved/j1", { method: "DELETE" })).status, 204);
    assert.deepEqual((await call("/api/saved")).body.map((j) => j.id), ["j2"]);
  }));

test("DELETE of a job that is not saved is harmless", () =>
  withServer(async (call) => {
    assert.equal((await call("/api/saved/j1", { method: "DELETE" })).status, 204);
    assert.equal((await call("/api/saved/%E0%A4%A", { method: "DELETE" })).status, 400);
  }));

test("saved jobs are still there after the server restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "api-restart-"));
  const file = join(dir, "saved.json");
  try {
    await withServer((call) => call("/api/saved", post({ jobId: "j5" })), file);
    await withServer(async (call) => {
      assert.deepEqual((await call("/api/saved")).body.map((j) => j.id), ["j5"]);
    }, file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the existing jobs endpoint still works", () =>
  withServer(async (call) => {
    const res = await call("/api/jobs?q=kosha");
    assert.deepEqual(res.body.map((j) => j.id), ["j4"]);
  }));
