(() => {
  "use strict";
  const data = window.NOBEL_LAUREATES;
  const $ = (id) => document.getElementById(id);
  if (!Array.isArray(data)) {
    $("result-count").textContent =
      "The collection could not be loaded. Please reload the page.";
    return;
  }
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const normalize = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const initials = (name) =>
    name
      .split(/\s+/)
      .filter((part) => !/^(von|van|de|a\.)$/i.test(part))
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("");
  const state = {
    search: "",
    field: "",
    institution: "",
    year: "",
    decade: "all",
    sort: "newest",
    view: "grid",
  };
  const latestYear = Math.max(...data.map((person) => person.year));
  const yearRange = `1969–${latestYear}`;
  document
    .querySelectorAll("[data-total]")
    .forEach((node) => (node.textContent = data.length));
  document
    .querySelectorAll("[data-years]")
    .forEach(
      (node) =>
        (node.textContent = new Set(data.map((person) => person.year)).size),
    );
  document
    .querySelectorAll("[data-range]")
    .forEach((node) => (node.textContent = yearRange));
  $("latest-title").textContent = `The ${latestYear} laureates`;
  if (latestYear > 2025)
    $("latest-theme").textContent = "Discover the latest Nobel-recognized work";
  $("hero-art").setAttribute(
    "aria-label",
    `The ${latestYear} laureates: ${data
      .filter((person) => person.year === latestYear)
      .map((person) => person.name)
      .join(", ")}`,
  );
  document.querySelector('meta[name="description"]').content =
    `Explore ${data.length} Nobel economics laureates, ${yearRange}, their ideas, and academic lineages.`;
  for (let decade = 2030; decade <= latestYear; decade += 10) {
    const button = document.createElement("button");
    button.dataset.decade = String(decade);
    button.textContent = `${decade}s`;
    button.setAttribute("aria-pressed", "false");
    document.querySelector(".decade-end").before(button);
  }
  const requiredInstitutions = [
    "MIT",
    "University of Chicago",
    "Harvard",
    "Stanford",
    "Princeton",
    "Yale",
    "Berkeley",
    "Columbia",
    "LSE",
  ];
  const fields = [...new Set(data.flatMap((p) => p.fields))].sort();
  const institutions = [...new Set(data.flatMap((p) => p.institutions))].sort();
  const years = [...new Set(data.map((p) => p.year))].sort((a, b) => b - a);
  function option(select, value, label = value) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    select.append(node);
  }
  fields.forEach((value) => option($("field"), value));
  requiredInstitutions
    .filter((value) => institutions.includes(value))
    .forEach((value) => option($("institution"), value));
  institutions
    .filter((value) => !requiredInstitutions.includes(value))
    .forEach((value) => option($("institution"), value));
  years.forEach((value) => option($("year"), value));
  function portrait(person, className = "") {
    return `<div class="portrait ${className}"><span class="initials" aria-hidden="true">${escape(initials(person.name))}</span>${person.portrait ? `<img src="${escape(person.portrait)}" alt="Portrait of ${escape(person.name)}" loading="lazy" decoding="async"${person.portraitPosition ? ` style="object-position:${escape(person.portraitPosition)}"` : ""}>` : ""}</div>`;
  }
  function bindImageFallbacks(root) {
    root.querySelectorAll("img").forEach((img) => {
      const fallback = () => {
        img.parentElement.setAttribute(
          "aria-label",
          `${img.alt}; initials placeholder`,
        );
        img.remove();
      };
      img.addEventListener("error", fallback, { once: true });
      if (img.complete && img.naturalWidth === 0) fallback();
    });
  }
  function tagHTML(person) {
    return person.fields
      .map((field) => `<span class="tag">${escape(field)}</span>`)
      .join("");
  }
  function cardHTML(person) {
    return `<button class="card" data-profile="${escape(person.id)}" aria-label="Read profile: ${escape(person.name)}, ${person.year}"><div class="card-image">${portrait(person)}<span class="sr-only">Awarded in ${person.year}</span></div><div class="card-body"><h3>${escape(person.name)}</h3><p class="card-institution">${escape(person.institution)}</p><div class="tags">${tagHTML(person)}</div><p class="card-contribution">${escape(person.contribution)}</p><div class="card-bottom"><span>DISCOVER THEIR WORK</span><span aria-hidden="true">↗</span></div></div></button>`;
  }
  function filterData() {
    return data
      .filter(
        (person) =>
          (!state.search.trim() ||
            normalize(state.search.trim())
              .split(/\s+/)
              .every((word) => normalize(person.name).includes(word))) &&
          (!state.field || person.fields.includes(state.field)) &&
          (!state.institution ||
            person.institutions.includes(state.institution)) &&
          (!state.year || person.year === Number(state.year)) &&
          (state.decade === "all" ||
            Math.floor(person.year / 10) * 10 === Number(state.decade)),
      )
      .sort((a, b) => {
        if (state.sort === "name") return a.name.localeCompare(b.name);
        return (
          (state.sort === "oldest" ? a.year - b.year : b.year - a.year) ||
          a.sortOrder - b.sortOrder
        );
      });
  }
  function synchronizeControls() {
    ["search", "field", "institution", "year", "sort"].forEach((key) => {
      $(key).value = state[key];
    });
    document
      .querySelectorAll("[data-decade]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.decade === state.decade),
        ),
      );
    $("grid-view").setAttribute("aria-pressed", String(state.view === "grid"));
    $("timeline-view").setAttribute(
      "aria-pressed",
      String(state.view === "timeline"),
    );
  }
  function updateAddress() {
    try {
      const url = new URL(location.href);
      [
        "search",
        "field",
        "institution",
        "year",
        "decade",
        "sort",
        "view",
      ].forEach((key) => {
        const defaultValue =
          { decade: "all", sort: "newest", view: "grid" }[key] || "";
        if (state[key] !== defaultValue) url.searchParams.set(key, state[key]);
        else url.searchParams.delete(key);
      });
      history.replaceState(null, "", url);
    } catch (_) {}
  }
  function render() {
    synchronizeControls();
    const matches = filterData();
    $("result-count").innerHTML =
      `<strong>${matches.length}</strong> of ${data.length} laureates${state.decade !== "all" ? ` · ${state.decade}s` : ""}`;
    $("cards").classList.toggle("timeline", state.view === "timeline");
    if (state.view === "timeline") {
      const grouped = new Map();
      matches.forEach((person) => {
        if (!grouped.has(person.year)) grouped.set(person.year, []);
        grouped.get(person.year).push(person);
      });
      const sortedYears = [...grouped.keys()].sort((a, b) =>
        state.sort === "oldest" ? a - b : b - a,
      );
      $("cards").innerHTML = sortedYears
        .map(
          (year) =>
            `<section class="timeline-year" aria-label="Laureates of ${year}"><h3 class="year-heading">${year}</h3><div class="year-grid">${grouped.get(year).map(cardHTML).join("")}</div></section>`,
        )
        .join("");
    } else $("cards").innerHTML = matches.map(cardHTML).join("");
    $("cards")
      .querySelectorAll("[data-profile]")
      .forEach((card) => {
        const person = data.find((p) => p.id === card.dataset.profile);
        const badge = document.createElement("span");
        badge.className = "year-badge";
        badge.textContent = person.year;
        card.querySelector(".portrait").append(badge);
      });
    $("empty-state").hidden = matches.length !== 0;
    $("active-filters").innerHTML = ["search", "field", "institution", "year"]
      .filter((key) => state[key])
      .map(
        (key) =>
          `<button class="filter-chip" data-clear="${key}" aria-label="Remove ${escape(key)} filter: ${escape(state[key])}">${escape(state[key])}<span aria-hidden="true">×</span></button>`,
      )
      .join("");
    bindImageFallbacks($("cards"));
    updateAddress();
  }
  function reset() {
    Object.assign(state, {
      search: "",
      field: "",
      institution: "",
      year: "",
      decade: "all",
    });
    render();
  }
  ["field", "institution", "year", "sort"].forEach((key) =>
    $(key).addEventListener("change", () => {
      state[key] = $(key).value;
      if (key === "year" && state.year) state.decade = "all";
      render();
    }),
  );
  $("search").addEventListener("input", () => {
    state.search = $("search").value;
    render();
  });
  document.querySelectorAll("[data-decade]").forEach((button) =>
    button.addEventListener("click", () => {
      state.decade = button.dataset.decade;
      state.year = "";
      render();
    }),
  );
  $("reset").addEventListener("click", reset);
  $("empty-reset").addEventListener("click", reset);
  $("growth-shortcut").addEventListener("click", () => {
    reset();
    state.field = "Growth";
    render();
  });
  $("active-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear]");
    if (button) {
      state[button.dataset.clear] = "";
      render();
    }
  });
  $("grid-view").addEventListener("click", () => {
    state.view = "grid";
    render();
  });
  $("timeline-view").addEventListener("click", () => {
    state.view = "timeline";
    render();
  });
  $("timeline-nav").addEventListener("click", () => {
    state.view = "timeline";
    render();
  });
  const dialog = $("profile");
  let opener = null;
  const enrichment = new Map(
    (window.NOBEL_ENRICHMENT || []).map((record) => [record.id, record]),
  );
  const sourceLinks = (sources) =>
    (sources || [])
      .map(
        (source) =>
          `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>`,
      )
      .join("");
  function academicRelationships(person) {
    const graph = window.NOBEL_LINEAGE;
    const record = enrichment.get(person.id);
    const key = `nobel-${person.id}`;
    const nodes = new Map((graph?.nodes || []).map((node) => [node.key, node]));
    const incoming = (graph?.edges || []).filter((edge) => edge.to === key);
    const outgoing = (graph?.edges || []).filter((edge) => edge.from === key);
    function relationshipCard(edge, student) {
      const node = nodes.get(student ? edge.to : edge.from);
      const yearLabel = edge.phdYear
        ? student
          ? ` · PhD ${edge.phdYear}`
          : ` · this laureate's PhD: ${edge.phdYear}`
        : "";
      return `<article class="academic-person">
        <h4>${node.homepage ? `<a href="${escape(node.homepage)}" target="_blank" rel="noopener noreferrer">${escape(node.name)} ↗</a>` : escape(node.name)}${node.laureateId ? `<span class="academic-nobel">Nobel ${node.person.year}</span>` : ""}</h4>
        <p class="relationship-label">${escape(edge.type)}${escape(yearLabel)}</p>
        ${node.field ? `<p class="academic-field">${escape(node.field)}</p>` : ""}
        ${student && node.careerSummary ? `<p>${escape(node.careerSummary)}</p><small>Career sources checked: ${escape(node.careerAsOf)}</small>` : ""}
        <details><summary>Relationship${student && node.careerSources?.length ? " & career" : ""} sources</summary><div class="evidence-links">${sourceLinks(edge.sources)}${student ? sourceLinks(node.careerSources) : ""}</div></details>
      </article>`;
    }
    return `<section class="profile-relationships"><h3>ACADEMIC LINEAGE</h3><button class="lineage-profile-link" data-show-lineage="${escape(person.id)}">Explore the relationship network <span aria-hidden="true">→</span></button>${incoming.length ? `<h4 class="relationship-heading">Doctoral advisers & committee</h4><div class="academic-people">${incoming.map((edge) => relationshipCard(edge, false)).join("")}</div>` : ""}<h4 class="relationship-heading">Selected PhD students & their paths</h4>${outgoing.length ? `<div class="academic-people">${outgoing.map((edge) => relationshipCard(edge, true)).join("")}</div>` : '<p class="coverage-note">No doctoral student relationship has been documented for this profile in this edition. This does not imply that the economist had no students.</p>'}<p class="coverage-note">${escape(record?.mentorshipNote || "A curated sample of documented relationships, not a complete list of students.")}</p>${record?.mentorshipSources?.length ? `<div class="evidence-links">${sourceLinks(record.mentorshipSources)}</div>` : ""}</section>`;
  }
  function lifeStory(person) {
    const story = enrichment.get(person.id)?.story;
    if (!story) return "";
    return `<section class="life-story"><p class="eyebrow">BEYOND THE RESEARCH</p><h3>${escape(story.title)}</h3><p>${escape(story.text)}</p><div class="evidence-links">${sourceLinks(story.sources)}</div></section>`;
  }
  function openProfile(id, trigger) {
    const person = data.find((p) => p.id === id);
    if (!person) return;
    opener = trigger;
    $("profile-content").innerHTML =
      `<div class="profile-layout"><div class="profile-side">${portrait(person)}<p class="photo-credit">${escape(person.imageCredit)}<br><a href="${escape(person.imageSource)}" target="_blank" rel="noopener noreferrer">Portrait source ↗</a></p><div class="profile-affiliation"><h3>${person.institutionBasis === "major teaching institution" ? "MAJOR TEACHING INSTITUTION" : "AFFILIATION AT THE AWARD"}</h3><p>${escape(person.institution)}</p><small>${person.institutionBasis === "major teaching institution" ? "Historical teaching affiliation; the official prize record does not list an award-time institution." : "Historical affiliation as recorded by NobelPrize.org; this is not necessarily a current appointment."}</small></div></div><div class="profile-main"><p class="eyebrow">ECONOMIC SCIENCES · ${person.year}</p><h2 id="profile-name">${escape(person.name)}</h2><div class="tags">${tagHTML(person)}</div><h3>THE IDEA, EXPLAINED</h3><p class="profile-explanation">${escape(person.contribution)}</p><h3>THE AWARD</h3><p class="profile-prize">Recipient of the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel in ${person.year}. ${person.prizeShare === "1" ? "Sole recipient that year." : `Prize share: ${escape(person.prizeShare)}.`}</p><h3>CONTINUE EXPLORING</h3><div class="profile-links"><a href="${escape(person.nobelUrl)}" target="_blank" rel="noopener noreferrer">Official Nobel Prize profile <span aria-hidden="true">↗</span></a>${person.homepage ? `<a href="${escape(person.homepage)}" target="_blank" rel="noopener noreferrer">${escape(person.homepageType || "Academic homepage")} <span aria-hidden="true">↗</span></a>` : ""}<a href="${escape(person.scholarUrl)}" target="_blank" rel="noopener noreferrer">Search Google Scholar <span aria-hidden="true">↗</span></a></div>${!person.homepage ? '<p class="homepage-unavailable">No suitable academic homepage was verified for this profile.</p>' : ""}<p class="source-note">Award facts: <a href="${escape(person.nobelUrl)}" target="_blank" rel="noopener noreferrer">NobelPrize.org</a>.${person.institutionSource ? ` Teaching affiliation: <a href="${escape(person.institutionSource)}" target="_blank" rel="noopener noreferrer">source</a>.` : ""} Field tags and plain-language explanations are editorial guides. Google Scholar opens a name search, not a verified author profile.</p></div></div>`;
    bindImageFallbacks($("profile-content"));
    const profileMain = $("profile-content").querySelector(".profile-main");
    profileMain.insertAdjacentHTML(
      "beforeend",
      academicRelationships(person) + lifeStory(person),
    );
    dialog.scrollTop = 0;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    $("close-profile").focus();
  }
  document.addEventListener("nobel:profile", (event) =>
    openProfile(event.detail.id, event.detail.trigger),
  );
  $("profile-content").addEventListener("click", (event) => {
    const button = event.target.closest("[data-show-lineage]");
    if (!button) return;
    opener = null;
    dialog.close();
    document.dispatchEvent(
      new CustomEvent("nobel:lineage", {
        detail: { id: button.dataset.showLineage },
      }),
    );
  });
  $("cards").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-profile]");
    if (trigger) openProfile(trigger.dataset.profile, trigger);
  });
  $("hero-portraits").innerHTML = data
    .filter((person) => person.year === latestYear)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
      (person) =>
        `<button class="hero-portrait" data-profile="${escape(person.id)}" aria-label="Read profile: ${escape(person.name)}, ${person.year}">${portrait(person)}<span class="hero-label">${escape(person.name)}</span></button>`,
    )
    .join("");
  bindImageFallbacks($("hero-portraits"));
  $("hero-portraits").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-profile]");
    if (trigger) openProfile(trigger.dataset.profile, trigger);
  });
  $("close-profile").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = "";
    if (opener?.isConnected) opener.focus();
  });
  const params = new URLSearchParams(location.search);
  ["search", "field", "institution", "year", "decade", "sort", "view"].forEach(
    (key) => {
      if (params.has(key)) state[key] = params.get(key);
    },
  );
  if (!fields.includes(state.field)) state.field = "";
  if (!institutions.includes(state.institution)) state.institution = "";
  if (!years.includes(Number(state.year))) state.year = "";
  if (
    ![
      "all",
      ...data.map((person) => String(Math.floor(person.year / 10) * 10)),
    ].includes(state.decade)
  )
    state.decade = "all";
  if (!["newest", "oldest", "name"].includes(state.sort)) state.sort = "newest";
  if (!["grid", "timeline"].includes(state.view)) state.view = "grid";
  render();
})();
