import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inspectSources, renderAlert } from "./monitor.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const sourcesPath = resolve(arg("--sources", "data/tax/irs-monitor/sources.json"));
const statePath = resolve(arg("--state", ".atlas-state/tax/irs-monitor/state.json"));
const alertPath = resolve(arg("--alert", ".atlas-state/tax/irs-monitor/alert.md"));
const summaryPath = resolve(arg("--summary", ".atlas-state/tax/irs-monitor/result.json"));

const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
let previousState = {};
try { previousState = JSON.parse(await readFile(statePath, "utf8")); } catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const { nextState, changes } = await inspectSources({ sources, previousState });
for (const path of [statePath, alertPath, summaryPath]) await mkdir(dirname(path), { recursive: true });
await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
await writeFile(alertPath, `${renderAlert(changes)}\n`);
await writeFile(summaryPath, `${JSON.stringify({ checkedAt: nextState.checkedAt, materialChangeCount: changes.length, changes }, null, 2)}\n`);

console.log(JSON.stringify({ checkedAt: nextState.checkedAt, materialChangeCount: changes.length }));
if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, `material_change_count=${changes.length}\n`, { flag: "a" });
}
