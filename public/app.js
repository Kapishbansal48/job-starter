const list = document.getElementById("jobs");
const savedList = document.getElementById("saved");
const savedEmpty = document.getElementById("saved-empty");
const search = document.getElementById("search");
const message = document.getElementById("message");

let savedIds = new Set();

function describe(job) {
  return `${job.title} at ${job.company}, ${job.location}. Rs ${job.stipend.toLocaleString("en-IN")} a month.`;
}

function showMessage(text) {
  message.textContent = text;
}

async function request(url, options) {
  const res = await fetch(url, options);
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Something went wrong");
  return body;
}

function makeButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function show(query = "") {
  const jobs = await request(`/api/jobs?q=${encodeURIComponent(query)}`);
  list.innerHTML = "";
  for (const job of jobs) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = describe(job);
    const button = makeButton(savedIds.has(job.id) ? "Saved" : "Save", () => save(job.id));
    button.disabled = savedIds.has(job.id);
    li.append(text, button);
    list.append(li);
  }
}

async function showSaved() {
  const jobs = await request("/api/saved");
  savedIds = new Set(jobs.map((j) => j.id));
  savedList.innerHTML = "";
  savedEmpty.hidden = jobs.length > 0;
  for (const job of jobs) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = describe(job);
    li.append(text, makeButton("Remove", () => remove(job.id)));
    savedList.append(li);
  }
}


async function refresh() {
  await showSaved();
  await show(search.value);
}

async function save(jobId) {
  try {
    showMessage("");
    await request("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    await refresh();
  } catch (err) {
    showMessage(`Could not save the job: ${err.message}`);
  }
}

async function remove(jobId) {
  try {
    showMessage("");
    await request(`/api/saved/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    await refresh();
  } catch (err) {
    showMessage(`Could not remove the job: ${err.message}`);
  }
}

search.addEventListener("input", () => show(search.value).catch((err) => showMessage(err.message)));
refresh().catch((err) => showMessage(`Could not load jobs: ${err.message}`));

