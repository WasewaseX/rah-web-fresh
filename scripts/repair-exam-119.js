// Task 119: repair the broken item the holder hit. The stored exam
// exmvzla6zmoa1d4 ("Advanced Grammar Collocations") carried an MCQ asking
// "Which sentence correctly uses the definite article?" keyed to
// "Pollution is a serious problem in many cities." - a sentence with NO
// definite article, among choices that were all ungrammatical. The holder's
// "many of the answers were wrong" complaint traces to exactly this class.
// This script replaces that one item with a sound, gated version and leaves
// everything else untouched. One-shot; safe to re-run (idempotent by stem).
const fs = require("fs");
const url = (fs.readFileSync(".env", "utf8").match(/DATABASE_URL="?([^"\n]+)"?/) || [])[1];
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url } } });

const REPLACEMENT = {
  id: "i2",
  type: "mcq",
  skill: "grammar",
  q: "Which sentence uses the definite article correctly?",
  choices: [
    "Persian is a language with soft sounds.",
    "The coffee in this cafe is the best in town.",
    "He is a best player on the team.",
  ],
  a: "The coffee in this cafe is the best in town.",
  accept: [],
  mustInclude: [],
  mustNotInclude: [],
  why: "Use THE for a specific thing both speakers can identify (the coffee in this cafe) and with superlatives (the best). First mention takes a/an, and Persian has no articles, so this is a classic Farsi-speaker trap.",
  tag: "articles",
};

(async () => {
  const row = await p.exam.findUnique({ where: { id: "exmvzla6zmoa1d4" } });
  if (!row) {
    console.log("exam row not found - nothing to repair");
    await p.$disconnect();
    return;
  }
  const items = JSON.parse(row.items);
  const before = items.findIndex((it) => it.type === "mcq" && /definite article/i.test(it.q));
  if (before === -1) {
    console.log("broken MCQ not present (already repaired?) - items:", items.length);
    await p.$disconnect();
    return;
  }
  console.log("replacing item", items[before].id, "| old key:", JSON.stringify(items[before].a));
  items[before] = REPLACEMENT;
  await p.exam.update({ where: { id: row.id }, data: { items: JSON.stringify(items) } });
  console.log("repaired. exam", row.id, "now has", items.length, "items with a sound articles MCQ");
  await p.$disconnect();
})();
