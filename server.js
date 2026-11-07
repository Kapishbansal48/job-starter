import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadJobs, searchJobs } from "./lib/jobs.js";
import { SavedStore, UnknownJobError } from "./lib/saved.js";

const PORT = Number(process.env.PORT ?? 3000);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 10_000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

export function createApp({ savedPath = process.env.SAVED_FILE ?? undefined } = {}) {
  const saved = new SavedStore(savedPath);
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/jobs") {
        const jobs = await loadJobs();
        return sendJson(res, 200, searchJobs(jobs, url.searchParams.get("q")));
      }
      if (url.pathname === "/api/saved") {
        if (req.method === "GET") return sendJson(res, 200, await saved.list(await loadJobs()));
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          const jobId = body?.jobId;
          if (typeof jobId !== "string" || !jobId) {
            throw new HttpError(400, 'Send JSON like { "jobId": "j1" }');
          }
          const { job, added } = await saved.save(await loadJobs(), jobId);
          return sendJson(res, added ? 201 : 200, job);
        }
      }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/saved/")) {
        let jobId;
        try {
          jobId = decodeURIComponent(url.pathname.slice("/api/saved/".length));
        } catch {
          throw new HttpError(400, "Job id is not valid");
        }
        await saved.remove(jobId);
        res.writeHead(204);
        return res.end();
      }
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js")) {
        const file = url.pathname === "/" ? "index.html" : "app.js";
        const type = file.endsWith(".html") ? "text/html" : "text/javascript";
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      if (err instanceof UnknownJobError) return sendJson(res, 404, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}
