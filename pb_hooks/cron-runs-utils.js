/**
 * cron_runs logger — shared util for hooks to record their last execution
 * to a row in the `cron_runs` PocketBase collection, so the admin UI
 * shows "did this cron run yesterday?" without tailing journalctl (Fase 0.2).
 *
 * Usage from any .pb.js:
 *   require(`${__hooks}/cron-runs-utils.js`).recordCronRun(
 *     "my-job",        // unique job name
 *     processed,       // number of records touched (optional)
 *     errors           // number of errors caught (optional, default 0)
 *   );
 *
 * The util itself is intentionally tiny — all PocketBase-specific logic
 * is here so each cron hook only has to call one function with literals
 * (no top-level var/const/let, which goja 0.23.x rejects with a cryptic
 * 400, see health.pb.js comment).
 */

function recordCronRun(job, processed, errors) {
  try {
    const collection = $app.findCollectionByNameOrId("cron_runs");
    let row = null;
    try {
      row = $app.findFirstRecordByFilter("cron_runs", "job = {:j}", { j: job });
    } catch (_) {
      // not found — falls through to create
    }
    if (!row) {
      row = new Record(collection);
      row.set("job", job);
    }
    if (typeof processed === "number") row.set("processed", processed);
    if (typeof errors === "number") row.set("errors", errors);
    row.set("lastRunAt", new Date().toISOString());
    $app.save(row);
  } catch (err) {
    // Never let logging failure break the cron itself
    console.error("[catdex:cron-runs] failed to record run for " + job + ":", err);
  }
}

module.exports = { recordCronRun: recordCronRun };
