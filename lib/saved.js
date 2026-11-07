import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findJob } from "./jobs.js";

export const DEFAULT_SAVED_PATH = new URL("../data/saved.json", import.meta.url);

export class UnknownJobError extends Error {
  constructor(jobId) {
    super(`No job with id "${jobId}"`);
    this.name = "UnknownJobError";
    this.jobId = jobId;
  }
}

export class SavedStore {
  #path;
  #queue = Promise.resolve();

  constructor(path = DEFAULT_SAVED_PATH) {
    this.#path = path instanceof URL ? fileURLToPath(path) : path;
  }

  async ids() {
    try {
      const ids = JSON.parse(await readFile(this.#path, "utf8"));
      if (!Array.isArray(ids)) throw new Error("saved file must hold a list");
      return ids;
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err; // a damaged file is an error, never silently overwritten
    }
  }

  async list(jobs) {
      return (await this.ids()).map((id) => findJob(jobs, id)).filter(Boolean);
    }

    save(jobs, jobId) {
        const job = findJob(jobs, jobId);
        if (!job) return Promise.reject(new UnknownJobError(jobId));
        return this.#change(async (ids) => {
          if (ids.includes(jobId)) return { value: { job, added: false } };
          return { ids: [...ids, jobId], value: { job, added: true } };
        });
      }

    remove(jobId) {
    return this.#change(async (ids) => {
      if (!ids.includes(jobId)) return { value: false };
      return { ids: ids.filter((id) => id !== jobId), value: true };
    });
  }

  #change(fn) {
    const run = this.#queue.then(async () => {
      const { ids, value } = await fn(await this.ids());
      if (ids) await this.#write(ids);
      return value;
    });
    this.#queue = run.catch(() => {}); // one failure must not block later changes
    return run;
  }

    async #write(ids) {
    await mkdir(dirname(this.#path), { recursive: true });
    const temp = `${this.#path}.tmp`;
    await writeFile(temp, JSON.stringify(ids, null, 2));
    await rename(temp, this.#path);
  }
}
