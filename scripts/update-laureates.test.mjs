import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { addNewLaureates } from "./update-laureates.mjs";

const root = new URL("../", import.meta.url);
const context = { window: {} };
vm.runInNewContext(
  fs.readFileSync(new URL("data/laureates.js", root), "utf8"),
  context,
);
vm.runInNewContext(
  fs.readFileSync(new URL("data/enrichment.js", root), "utf8"),
  context,
);
const people = JSON.parse(JSON.stringify(context.window.NOBEL_LAUREATES));
const enrichment = JSON.parse(JSON.stringify(context.window.NOBEL_ENRICHMENT));
const roster = JSON.parse(
  fs.readFileSync(new URL("data/source-roster.json", root), "utf8"),
);
people[0].contribution = "An intentionally hand-edited explanation.";
enrichment[0].mentorshipNote =
  "An intentionally hand-edited relationship note.";
const unchanged = JSON.stringify({ people, enrichment });
const fixture = {
  id: "test-new-id",
  fullName: { en: "Test Import" },
  nobelPrizes: [
    {
      category: { en: "Economic Sciences" },
      awardYear: "2026",
      sortOrder: "1",
      portion: "1",
      affiliations: [],
      links: [
        {
          class: ["laureate facts"],
          href: "https://www.nobelprize.org/prizes/economic-sciences/2026/test-fixture/facts/",
        },
      ],
    },
  ],
};
const update = addNewLaureates(
  [fixture, fixture],
  people,
  enrichment,
  roster,
  "2026-10-06",
);
assert.equal(update.added.length, 1);
assert.equal(update.people.length, people.length + 1);
assert.equal(update.added[0].portrait, null);
assert.equal(update.added[0].draft, true);
assert.equal(update.added[0].homepage, null);
assert.deepEqual(
  update.people.find((person) => person.id === people[0].id),
  people[0],
);
assert.deepEqual(
  update.enrichment.find((record) => record.id === enrichment[0].id),
  enrichment[0],
);
assert.equal(JSON.stringify({ people, enrichment }), unchanged);
assert.equal(
  addNewLaureates(
    [fixture],
    update.people,
    update.enrichment,
    update.roster,
    "2026-10-07",
  ).added.length,
  0,
);
assert.throws(
  () =>
    addNewLaureates(
      [
        {
          ...fixture,
          id: "invalid",
          nobelPrizes: [{ ...fixture.nobelPrizes[0], links: [] }],
        },
      ],
      people,
      enrichment,
      roster,
      "2026-10-06",
    ),
  /Incomplete official record/,
);
console.log(
  "PASS: new-entry import, duplicate API entries, idempotence, initials fallback, pending metadata, preserved manual edits, and incomplete-response rejection. Test fixtures are never written to site data.",
);
