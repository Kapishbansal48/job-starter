import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadJobs } from "../job-board-starter/lib/jobs.js";
import { SavedStore, UnknownJobError } from "../job-board-starter/lib/saved.js";

async function withStore(fn) {
  const dir = await mkdtemp(join(tmpdir(), "saved-"));
  try {
    const file = join(dir, "nested", "saved.json");
    await fn(new SavedStore(file), file, await loadJobs());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("starts empty when there is no file yet", () =>
  withStore(async (store, _file, jobs) => {
    assert.deepEqual(await store.ids(), []);
    assert.deepEqual(await store.list(jobs), []);
  }));

test("saves a job and lists it with its full details", () =>
  withStore(async (store, _file, jobs) => {
    const result = await store.save(jobs, "j2");
    assert.equal(result.added, true);
    assert.equal(result.job.company, "Kite Learning");
    assert.deepEqual((await store.list(jobs)).map((j) => j.id), ["j2"]);
  }));

test("saving the same job twice keeps one copy", () =>
  withStore(async (store, file, jobs) => {
    assert.equal((await store.save(jobs, "j1")).added, true);
    assert.equal((await store.save(jobs, "j1")).added, false);
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["j1"]);
  }));

test("saving many times at once still keeps one copy of each job", () =>
  withStore(async (store, _file, jobs) => {
    await Promise.all(["j1", "j2", "j1", "j3", "j2", "j1"].map((id) => store.save(jobs, id)));
    assert.deepEqual((await store.ids()).sort(), ["j1", "j2", "j3"]);
  }));

test("an unknown job id is rejected and nothing is written", () =>
  withStore(async (store, file, jobs) => {
    await assert.rejects(store.save(jobs, "nope"), UnknownJobError);
    assert.deepEqual(await store.ids(), []);
    await assert.rejects(readFile(file), { code: "ENOENT" });
  }));

test("removes a saved job and says whether it was saved", () =>
  withStore(async (store, _file, jobs) => {
    await store.save(jobs, "j1");
    await store.save(jobs, "j2");
    assert.equal(await store.remove("j1"), true);
    assert.equal(await store.remove("j1"), false);
    assert.deepEqual(await store.ids(), ["j2"]);
  }));

test("keeps jobs in the order they were saved", () =>
  withStore(async (store, _file, jobs) => {
    for (const id of ["j3", "j1", "j2"]) await store.save(jobs, id);
    assert.deepEqual((await store.list(jobs)).map((j) => j.id), ["j3", "j1", "j2"]);
  }));

test("saved jobs survive a new store reading the same file", () =>
  withStore(async (store, file, jobs) => {
    await store.save(jobs, "j4");
    assert.deepEqual(await new SavedStore(file).ids(), ["j4"]);
  }));

test("listing skips saved ids that are no longer in the job list", () =>
  withStore(async (store, file, jobs) => {
    await store.save(jobs, "j1");
    await store.save(jobs, "j2");
    const withoutJ1 = jobs.filter((j) => j.id !== "j1");
    assert.deepEqual((await store.list(withoutJ1)).map((j) => j.id), ["j2"]);
  }));

test("a damaged saved file is reported, not overwritten", () =>
  withStore(async (store, file, jobs) => {
    await store.save(jobs, "j1");
    await writeFile(file, "{ not json");
    await assert.rejects(store.save(jobs, "j2"), SyntaxError);
    assert.equal(await readFile(file, "utf8"), "{ not json");
  }));
