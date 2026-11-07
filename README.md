## Job board: saved jobs

A small job board (Node 20, no packages to install). Students can now save the jobs they like and come back to them. The jobs and companies are made up.

## What I built
A Save button on every job. A saved job shows a disabled Saved button.
A Saved jobs list on the same page, with a Remove button on each job.
Saved jobs are kept in data/saved.json, so they survive a page reload and a server restart.
An API behind it:
Request	Result
POST /api/saved with { "jobId": "j1" }	201 and the job when newly saved. 200 and the job if already saved (never a second copy).
GET /api/saved	200 and the saved jobs, in the order they were saved.
DELETE /api/saved/:jobId	204. Also 204 if the job was not saved.

Errors are returned as { "error": "..." }: 404 for an unknown job id, 400 for a body that is not valid JSON or has no jobId, 413 for a very large body.

## How to run it

You need Node 20 or newer.

npm start      # then open http://localhost:3000
npm test       # 23 tests (3 from the starter, 20 for saved jobs)

Optional settings: PORT=4000 changes the port and SAVED_FILE=/path/file.json changes where saved jobs are kept. The tests use a temporary file, so they never change data/saved.json.

## Where things are
lib/saved.js: the saved-jobs store (reads and writes the JSON file).
server.js: the web server and the API routes.
public/: the page and its script.
test/saved.test.js: tests for the store. test/api.test.js: tests for the API.

## A decision I made

The file stores only job ids, not copies of the jobs. GET /api/saved looks each id up in jobs.json when asked. A copy would go out of date as soon as a job's title or stipend changed, and I would have two places to keep in sync. The cost: if a saved job is removed from jobs.json, it quietly disappears from the saved list.

Two smaller choices in the same spirit: changes to the file run one at a time (so two quick saves cannot overwrite each other), and each write goes to a temp file that is then renamed (so a crash cannot leave half a file). A damaged saved.json gives an error instead of being replaced.

## What I would do next
Make saved jobs per student. Today there is one shared list. A real site needs sign-in, and a database instead of a file.
Show "no longer available" for a saved job that was taken down, instead of hiding it.
Add browser tests for the page. The page script has no automated tests; I checked it by clicking through it.

## How I used tools

I used Claude, an AI assistant, to help build this. It wrote the first version of the store (lib/saved.js), the API routes in server.js, the page script and the tests. EDIT THIS LINE: say what you read, ran, changed or fixed yourself.