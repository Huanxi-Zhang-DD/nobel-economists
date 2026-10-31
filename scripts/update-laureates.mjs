import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const endpoint = `https://api.nobelprize.org/2.1/laureates?nobelPrizeCategory=eco&nobelPrizeYear=1969&yearTo=${new Date().getUTCFullYear()}&limit=200`;
const aliases = {
  "Massachusetts Institute of Technology (MIT)": "MIT",
  "Harvard University": "Harvard",
  "Stanford University": "Stanford",
  "Princeton University": "Princeton",
  "Yale University": "Yale",
  "University of California, Berkeley": "Berkeley",
  "Columbia University": "Columbia",
  "London School of Economics and Political Science": "LSE",
  "London School of Economics": "LSE",
};

export function assertCompleteArchive(official, people) {
  const ids = new Set(official.filter((person) => person.nobelPrizes?.some(
    (prize) => prize.category?.en === "Economic Sciences",
  )).map((person) => String(person.id)));
  if (ids.size < 99 || people.some((person) => !ids.has(person.id)))
    throw new Error("Incomplete Nobel archive; local files were not changed.");
}

export function addNewLaureates(official, people, enrichment, roster, date) {
  const ids = new Set(people.map((person) => person.id));
  const added = [];
  for (const person of official) {
    const award = person.nobelPrizes?.find(
      (prize) =>
        prize.category?.en === "Economic Sciences" &&
        Number(prize.awardYear) >= 1969,
    );
    const id = String(person.id);
    if (!award || ids.has(id)) continue;
    const name = person.fullName?.en || person.knownName?.en;
    const nobelUrl = award.links?.find((link) =>
      link.class?.includes("laureate facts"),
    )?.href;
    const year = Number(award.awardYear);
    if (!name || !/^https:\/\/www\.nobelprize\.org\/prizes\/economic-sciences\//.test(nobelUrl || "") ||
        !Number.isInteger(year) || year > new Date().getUTCFullYear() || !person.id)
      throw new Error(`Incomplete official record: ${id}`);
    const affiliations = (award.affiliations || [])
      .map((affiliation) => {
        const name = affiliation.name?.en;
        const city = affiliation.city?.en?.split(",")[0];
        return name === "University of California" && city
          ? `${name}, ${city}`
          : name;
      })
      .filter(Boolean);
    const prizeMotivation = award.motivation?.en?.trim() || null;
    added.push({
      id,
      name,
      year,
      sortOrder: Number(award.sortOrder || 1),
      institution:
        affiliations.join(" · ") ||
        "No institution listed in the official prize record",
      institutions: affiliations.length
        ? affiliations.map((name) => aliases[name] || name)
        : ["Not listed"],
      institutionBasis: "affiliation at award",
      fields: ["Pending classification"],
      prizeMotivation,
      contribution:
        (prizeMotivation ? `The official Nobel Prize citation recognizes this laureate ${prizeMotivation}. ` : "") +
        "A plain-language explanation of this laureate’s contribution is awaiting editorial review. Visit the official Nobel Prize profile for the confirmed award citation and announcement materials.",
      nobelUrl,
      prizeShare: award.portion,
      homepage: null,
      homepageType: null,
      homepageSource: null,
      scholarUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(name)}`,
      portrait: null,
      imageCredit: "Portrait awaiting selection; initials shown.",
      imageSource: nobelUrl,
      imageOriginalUrl: null,
      portraitOrigin: null,
      draft: true,
    });
    ids.add(id);
  }
  const profiles = [...people, ...added].sort(
    (a, b) => b.year - a.year || a.sortOrder - b.sortOrder,
  );
  const stories = [
    ...enrichment,
    ...added.map((person) => ({
      id: person.id,
      draft: true,
      story: {
        title: "A life story to come",
        text: "This laureate was newly announced. A source-checked biography will be added after editorial review. The official Nobel profile below provides confirmed prize information in the meantime.",
        sources: [{ label: "Official Nobel profile", url: person.nobelUrl }],
        verifiedOn: date,
      },
      students: [],
      advisors: [],
      mentorshipNote:
        "Doctoral relationships have not yet been reviewed for this newly added profile.",
    })),
  ];
  return {
    added,
    people: profiles,
    enrichment: stories,
    roster: added.length
      ? {
          source: endpoint,
          verifiedOn: date,
          laureates: profiles.map(({ id, name, year }) => ({ id, year, name })),
        }
      : roster,
  };
}

async function update() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const write = (file, content) => fs.writeFileSync(
    path.join(root, file),
    read(file).includes("\r\n") ? content.replace(/\r?\n/g, "\r\n") : content,
  );
  const context = { window: {} };
  vm.runInNewContext(read("data/laureates.js"), context);
  vm.runInNewContext(read("data/enrichment.js"), context);
  const official = [];
  for (let offset = 0; ; offset += 200) {
    const response = await fetch(`${endpoint}&offset=${offset}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(
        `Official Nobel API returned ${response.status}; local files were not changed.`,
      );
    const result = await response.json();
    if (!Array.isArray(result.laureates))
      throw new Error(
        "Unexpected Nobel API response; local files were not changed.",
      );
    official.push(...result.laureates);
    if (result.laureates.length < 200) break;
  }
  assertCompleteArchive(official, context.window.NOBEL_LAUREATES);
  const result = addNewLaureates(
    official,
    context.window.NOBEL_LAUREATES,
    context.window.NOBEL_ENRICHMENT,
    JSON.parse(read("data/source-roster.json")),
    new Date().toISOString().slice(0, 10),
  );
  if (result.added.length) {
    write(
      "data/laureates.js",
      `window.NOBEL_LAUREATES = ${JSON.stringify(result.people, null, 2)};\n`,
    );
    write(
      "data/enrichment.js",
      `window.NOBEL_ENRICHMENT = ${JSON.stringify(result.enrichment, null, 2)};\n`,
    );
    write(
      "data/source-roster.json",
      JSON.stringify(result.roster, null, 2) + "\n",
    );
  }
  write(
    "data/update-status.json",
    JSON.stringify(
      {
        checkedOn: new Date().toISOString().slice(0, 10),
        source: endpoint,
        latestYear: Math.max(...result.people.map((person) => person.year)),
        added: result.added.map((person) => person.id),
      },
      null,
      2,
    ) + "\n",
  );
  if (!result.added.length) {
    console.log("No new economics laureates. All local edits preserved.");
    return;
  }
  console.log(
    `Added ${result.added.length} laureate(s): ${result.added.map((person) => person.name).join(", ")}. Editorial details are marked as pending.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  update().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
