// Read-only measurement: report the largest function (physical lines, the
// scanner's counting) per file, using the project's own eslint flat config
// with max-lines-per-function lowered to 1 so every function is flagged with
// its exact size. No config files are written; no other checks are changed.
import { ESLint } from "eslint";
import { pathToFileURL } from "url";

const projectConfig = (await import(pathToFileURL("/home/z/my-project/eslint.config.mjs").href)).default;

const overrideConfig = [
  ...projectConfig.filter((c) => !c.rules || (!c.rules["max-lines-per-function"] && !c.rules["max-lines"])),
  { rules: { "max-lines-per-function": ["error", { max: 1 }], "max-lines": "off" } },
];

const files = process.argv.slice(2);
const eslint = new ESLint({ overrideConfig, cwd: "/home/z/my-project" });
const results = await eslint.lintFiles(files);

const perFile = new Map();
for (const r of results) {
  let largest = null;
  for (const m of r.messages) {
    if (m.ruleId !== "max-lines-per-function") continue;
    const n = parseInt((m.message.match(/\((\d+)\)/) || [])[1] ?? "0", 10);
    const name = (m.message.match(/(?:function|method) '?([\w.$]+)'?/) || [])[1] ?? m.message.split(" ")[0] + m.message.split(" ")[1];
    if (!largest || n > largest.n) largest = { n, name };
  }
  perFile.set(r.filePath, largest ? `${largest.name} = ${largest.n}` : "(no functions)");
}
for (const [f, v] of [...perFile.entries()].sort()) console.log(`${f.replace("/home/z/my-project/", "")}: largest ${v}`);
