import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const context = { window: {} };
vm.runInNewContext(read("data/laureates.js"), context);
const people = context.window.NOBEL_LAUREATES;
const roster = JSON.parse(read("data/source-roster.json")).laureates;
assert.equal(
  people.filter((person) => person.year <= 2025).length,
  99,
  "Expected 99 laureates through 2025",
);
assert.equal(
  new Set(people.map((p) => p.id)).size,
  people.length,
  "Duplicate Nobel ID",
);
assert.equal(
  new Set(people.map((p) => p.name.toLowerCase())).size,
  people.length,
  "Duplicate name",
);
assert.equal(
  new Set(people.map((p) => p.nobelUrl)).size,
  people.length,
  "Duplicate profile URL",
);
assert.equal(
  new Set(people.map((p) => p.portrait).filter(Boolean)).size,
  people.filter((p) => p.portrait).length,
  "Portrait filename collision",
);
const latestYear = Math.max(...people.map((person) => person.year));
assert.equal(
  new Set(people.map((p) => p.year)).size,
  latestYear - 1969 + 1,
  "Missing award year",
);
for (let year = 1969; year <= latestYear; year++)
  assert(
    people.some((p) => p.year === year),
    `Missing ${year}`,
  );
const official = new Map(roster.map((p) => [p.id, p]));
assert.equal(official.size, people.length);
const required = [
  "Growth",
  "Macroeconomics",
  "Econometrics",
  "Labor",
  "Development",
  "Political Economy",
  "Industrial Organization",
  "Finance",
  "Game Theory",
  "Mechanism Design",
  "Behavioral Economics",
  "Economic History",
  "International Trade",
  "Public Economics",
];
const allFields = new Set(people.flatMap((p) => p.fields));
required.forEach((field) =>
  assert(allFields.has(field), `Missing field: ${field}`),
);
[
  "MIT",
  "University of Chicago",
  "Harvard",
  "Stanford",
  "Princeton",
  "Yale",
  "Berkeley",
  "Columbia",
  "LSE",
].forEach((institution) =>
  assert(
    people.some((p) => p.institutions.includes(institution)),
    `Missing institution: ${institution}`,
  ),
);
const checkLocal = (file) => {
  assert(
    !file.startsWith("/") && !file.includes(".."),
    `Path must be relative: ${file}`,
  );
  assert(fs.existsSync(path.join(root, file)), `Missing local asset: ${file}`);
  const resolved = new URL(file, "https://example.github.io/nobel-economists/")
    .pathname;
  assert(resolved.startsWith("/nobel-economists/"), `Subpath escape: ${file}`);
};
const httpURL = (url, label) => {
  const u = new URL(url);
  assert(["https:", "http:"].includes(u.protocol), `Invalid URL: ${label}`);
};
for (const p of people) {
  const record = official.get(p.id);
  assert(record, `Unofficial ID: ${p.id}`);
  assert.equal(p.year, record.year);
  assert.equal(p.name, record.name);
  for (const key of [
    "name",
    "institution",
    "contribution",
    "nobelUrl",
    "scholarUrl",
    "imageCredit",
    "imageSource",
  ])
    assert(
      typeof p[key] === "string" && p[key].trim(),
      `Missing ${key} for ${p.name}`,
    );
  assert(
    p.fields.length && p.institutions.length,
    `Missing classification: ${p.name}`,
  );
  assert(
    p.contribution.split(/\s+/).length >= 25,
    `Insufficient explanation: ${p.name}`,
  );
  assert(
    p.nobelUrl.startsWith(
      "https://www.nobelprize.org/prizes/economic-sciences/",
    ),
    `Invalid Nobel source: ${p.name}`,
  );
  assert(
    p.scholarUrl.startsWith("https://scholar.google.com/scholar?q="),
    `Invalid Scholar search: ${p.name}`,
  );
  [p.nobelUrl, p.scholarUrl, p.imageSource].forEach((url) =>
    httpURL(url, p.name),
  );
  if (p.homepage) {
    httpURL(p.homepage, p.name);
    assert(p.homepageSource, `Unsourced homepage: ${p.name}`);
  }
  if (p.portrait) {
    checkLocal(p.portrait);
    const bytes = fs.readFileSync(path.join(root, p.portrait));
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
    const gif = ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
    const avif =
      bytes.toString("ascii", 4, 8) === "ftyp" &&
      /avif|avis/.test(bytes.toString("ascii", 8, 64));
    assert(
      bytes.length > 500 && (jpeg || png || webp || gif || avif),
      `Invalid portrait file: ${p.name}`,
    );
  }
}
for (const match of read("index.html").matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const file = match[1];
  if (!/^(?:https?:|data:)/.test(file) && file !== "./") checkLocal(file);
}
new vm.Script(read("app.js"), { filename: "app.js" });
vm.runInNewContext(read("data/enrichment.js"), context);
const enrichment = context.window.NOBEL_ENRICHMENT;
assert.equal(
  enrichment.length,
  people.length,
  "Every laureate needs a sourced life story or pending draft",
);
assert.equal(
  new Set(enrichment.map((record) => record.id)).size,
  people.length,
  "Duplicate enrichment ID",
);
const relationshipTypes = new Set([
  "doctoral advisor",
  "doctoral co-advisor",
  "dissertation committee",
]);
const validSources = (sources, label) => {
  assert(
    Array.isArray(sources) && sources.length,
    `Missing evidence: ${label}`,
  );
  sources.forEach((source) => {
    assert(source.label?.trim(), `Missing source label: ${label}`);
    httpURL(source.url, label);
  });
};
const nameEnds = (name) => {
  const parts = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(
      (part) =>
        part.length > 1 && !["sir", "jr", "von", "van", "de"].includes(part),
    );
  return [parts[0], parts.at(-1)];
};
for (const record of enrichment) {
  assert(official.has(record.id), `Unknown enriched laureate: ${record.id}`);
  assert(
    record.story?.title && record.story.text?.split(/\s+/).length >= 20,
    `Missing life story: ${record.id}`,
  );
  validSources(record.story.sources, `life story ${record.id}`);
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(record.story.verifiedOn),
    `Undated story: ${record.id}`,
  );
  assert(record.mentorshipNote?.trim(), `Missing coverage note: ${record.id}`);
  if (record.mentorshipSources)
    validSources(record.mentorshipSources, `coverage note ${record.id}`);
  for (const kind of ["students", "advisors"]) {
    assert(Array.isArray(record[kind]), `Missing ${kind}: ${record.id}`);
    const relationships = new Set();
    for (const person of record[kind]) {
      assert(person.name?.trim(), `Missing academic name: ${record.id}`);
      assert(
        relationshipTypes.has(person.relationshipType),
        `Unsupported doctoral relationship: ${person.name}`,
      );
      validSources(
        person.relationshipSources,
        `doctoral relationship ${person.name}`,
      );
      if (person.laureateId) {
        assert(
          official.has(person.laureateId),
          `Unknown related Nobel ID: ${person.name}`,
        );
        assert.deepEqual(
          nameEnds(person.name),
          nameEnds(official.get(person.laureateId).name),
          `Related Nobel ID/name mismatch: ${person.name}`,
        );
      }
      if (person.phdYear != null)
        assert(
          Number.isInteger(person.phdYear) &&
            person.phdYear >= 1850 &&
            person.phdYear <= 2026,
          `Invalid PhD year: ${person.name}`,
        );
      const key = `${person.laureateId || person.name.toLowerCase()}:${person.relationshipType}`;
      assert(
        !relationships.has(key),
        `Duplicate relationship: ${record.id} / ${person.name}`,
      );
      relationships.add(key);
      if (kind === "students") {
        httpURL(person.homepage, `student homepage ${person.name}`);
        assert(
          person.field?.trim() && person.careerSummary?.trim(),
          `Missing student research / career: ${person.name}`,
        );
        assert(
          /^\d{4}-\d{2}-\d{2}$/.test(person.careerAsOf),
          `Undated student career: ${person.name}`,
        );
        validSources(person.careerSources, `career of ${person.name}`);
      }
    }
  }
}
context.document = { getElementById: () => null };
vm.runInNewContext(read("lineage.js"), context);
const graph = context.window.NOBEL_LINEAGE;
const nodes = new Map(graph.nodes.map((node) => [node.key, node]));
assert.equal(nodes.size, graph.nodes.length, "Duplicate network node");
assert.equal(
  new Set(graph.edges.map((edge) => edge.key)).size,
  graph.edges.length,
  "Duplicate canonical edge",
);
for (const edge of graph.edges) {
  assert(
    nodes.has(edge.from) && nodes.has(edge.to),
    "Unknown network endpoint",
  );
  assert.notEqual(edge.from, edge.to, "Self-supervision edge");
  validSources(edge.sources, edge.key);
}
function visit(key, visiting = new Set(), visited = new Set()) {
  assert(!visiting.has(key), `Doctoral-adviser cycle at ${key}`);
  if (visited.has(key)) return;
  visiting.add(key);
  graph.edges
    .filter(
      (edge) => edge.from === key && edge.type !== "dissertation committee",
    )
    .forEach((edge) => visit(edge.to, visiting, visited));
  visiting.delete(key);
  visited.add(key);
}
graph.nodes.forEach((node) => visit(node.key));
const solow = people.find((person) => person.name.includes("Solow"));
const solowStudents = graph.edges
  .filter((edge) => edge.from === `nobel-${solow.id}`)
  .map((edge) => nodes.get(edge.to).name);
["Akerlof", "Diamond", "Nordhaus", "Stiglitz"].forEach((name) =>
  assert(
    solowStudents.some((student) => student.includes(name)),
    `Missing documented Solow → ${name} connection`,
  ),
);
assert(
  !/url\(["']?\//.test(read("styles.css")),
  "CSS contains root-absolute asset URLs",
);
assert(
  fs.existsSync(path.join(root, ".github/workflows/pages.yml")),
  "Missing Pages workflow",
);
console.log(
  `PASS: ${people.length} unique laureates (${people.filter((person) => person.year <= 2025).length} through 2025), ${latestYear - 1969 + 1} award years, official roster matched, required filters, ${people.filter((p) => p.portrait).length} local portraits, JavaScript syntax and repository-subpath asset resolution.`,
);
console.log(
  `PASS: ${enrichment.length} sourced life stories, ${graph.edges.length} unique documented doctoral relationships, canonical person nodes, source URLs, student homepages / dated careers, and no adviser cycles.`,
);
