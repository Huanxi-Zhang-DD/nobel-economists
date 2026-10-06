(() => {
  "use strict";
  const laureates = window.NOBEL_LAUREATES || [];
  const records = window.NOBEL_ENRICHMENT || [];
  const nodes = new Map(),
    edges = new Map();
  const norm = (name) =>
    String(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const names = new Map(
    laureates.map((person) => [norm(person.name), person.id]),
  );
  laureates.forEach((person) =>
    nodes.set(`nobel-${person.id}`, {
      key: `nobel-${person.id}`,
      name: person.name,
      laureateId: person.id,
      person,
      homepage: person.homepage,
      field: person.fields.join(" · "),
    }),
  );
  const sources = (first = [], second = []) => [
    ...new Map(
      [...first, ...second].map((source) => [source.url, source]),
    ).values(),
  ];
  function nodeFor(person) {
    const nobelId = person.laureateId || names.get(norm(person.name));
    const key = nobelId ? `nobel-${nobelId}` : `academic-${norm(person.name)}`;
    const previous = nodes.get(key);
    nodes.set(key, {
      ...person,
      ...previous,
      key,
      homepage: person.homepage || previous?.homepage || null,
      field: person.field || previous?.field || "",
      careerSummary: person.careerSummary || previous?.careerSummary || "",
      careerAsOf: person.careerAsOf || previous?.careerAsOf || "",
      careerSources: sources(previous?.careerSources, person.careerSources),
    });
    return key;
  }
  function addEdge(from, to, relationship) {
    if (from === to) return;
    const key = `${from}>${to}:${relationship.relationshipType}`;
    const previous = edges.get(key);
    edges.set(key, {
      key,
      from,
      to,
      type: relationship.relationshipType,
      phdYear: relationship.phdYear || previous?.phdYear || null,
      sources: sources(previous?.sources, relationship.relationshipSources),
    });
  }
  records.forEach((record) => {
    const key = `nobel-${record.id}`;
    (record.students || []).forEach((student) =>
      addEdge(key, nodeFor(student), student),
    );
    (record.advisors || []).forEach((advisor) =>
      addEdge(nodeFor(advisor), key, advisor),
    );
  });
  window.NOBEL_LINEAGE = {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
})();

(() => {
  "use strict";
  const graph = window.NOBEL_LINEAGE;
  const $ = (id) => document.getElementById(id);
  if (!$("lineage-focus") || !graph) return;
  const nodes = new Map(graph.nodes.map((node) => [node.key, node]));
  const evidence = new Map(
    (window.NOBEL_ENRICHMENT || []).map((record) => [record.id, record]),
  );
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
  const links = (items) =>
    (items || [])
      .map(
        (source) =>
          `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>`,
      )
      .join("");
  const degree = (key) =>
    graph.edges.filter((edge) => edge.from === key || edge.to === key).length;
  let focus = "";
  const connected = graph.nodes
    .filter((node) => node.laureateId && degree(node.key))
    .sort(
      (a, b) => degree(b.key) - degree(a.key) || a.name.localeCompare(b.name),
    );
  const laureates = graph.nodes
    .filter((node) => node.laureateId)
    .sort((a, b) => a.name.localeCompare(b.name));
  laureates.forEach((node) => {
    const option = document.createElement("option");
    option.value = node.key;
    option.textContent = `${node.name} (${node.person.year})${degree(node.key) ? "" : " · no documented links yet"}`;
    $("lineage-focus").append(option);
  });
  const mentorCount = new Set(graph.edges.map((edge) => edge.from)).size;
  $("lineage-count").textContent =
    `${graph.edges.length} documented relationships · ${mentorCount} advisers / committee members · ${graph.nodes.filter((node) => degree(node.key)).length} people`;
  const entryPoints = ["Solow", "Arrow", "Wilson", "Card", "Banerjee", "Lucas"]
    .map((name) => connected.find((node) => node.name.includes(name)))
    .filter(Boolean);
  const shortcuts = [
    ...new Map(
      [...entryPoints, ...connected].map((node) => [node.key, node]),
    ).values(),
  ].slice(0, 6);
  $("lineage-shortcuts").innerHTML = shortcuts
    .map(
      (node) =>
        `<button data-focus="${escape(node.key)}">${escape(node.name)} <span>${escape(node.person.fields[0])}</span></button>`,
    )
    .join("");
  function inspect(key) {
    const node = nodes.get(key);
    if (!node) return;
    $("lineage-canvas")
      .querySelectorAll("[data-node]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.node === key),
        ),
      );
    const relationships = graph.edges.filter(
      (edge) =>
        (edge.from === focus && edge.to === key) ||
        (edge.to === focus && edge.from === key),
    );
    const center = nodes.get(focus);
    $("lineage-inspector").innerHTML =
      `<div class="lineage-person"><p class="eyebrow">${node.laureateId ? `NOBEL ECONOMICS · ${node.person.year}` : "ACADEMIC PROFILE"}</p><h3>${escape(node.name)}</h3><p class="lineage-field">${escape(node.field)}</p>${node.careerSummary ? `<p>${escape(node.careerSummary)}</p><p class="verification-date">Career information checked: ${escape(node.careerAsOf)}. Appointments may change.</p>` : node.person ? `<p>${escape(node.person.institution)} <span class="verification-date">(historical award affiliation)</span></p>` : '<p class="verification-date">No career summary is documented in this edition.</p>'}<div class="lineage-actions">${node.homepage ? `<a href="${escape(node.homepage)}" target="_blank" rel="noopener noreferrer">Visit academic homepage ↗</a>` : ""}${node.laureateId ? `<button data-open-nobel="${escape(node.laureateId)}">Read Nobel profile ↗</button>${key !== focus ? `<button data-focus="${escape(key)}">Explore this lineage →</button>` : ""}` : ""}</div></div><div class="lineage-evidence"><h4>${relationships.length ? "RELATIONSHIP EVIDENCE" : "READING & SOURCES"}</h4>${relationships.map((edge) => `<p><strong>${escape(edge.type)}</strong>${edge.phdYear ? ` · PhD ${edge.phdYear}` : ""}<br>${escape(nodes.get(edge.from).name)} → ${escape(nodes.get(edge.to).name)}</p><div class="evidence-links">${links(edge.sources)}</div>`).join("")}${node.careerSources?.length ? `<h4>CAREER / RESEARCH SOURCES</h4><div class="evidence-links">${links(node.careerSources)}</div>` : ""}${key === focus ? `<p class="verification-date">${escape(evidence.get(center.laureateId)?.mentorshipNote || "Selected source-backed relationships; this is not a complete alumni directory.")}</p>${node.person ? `<div class="evidence-links">${links([{ label: "Official Nobel profile", url: node.person.nobelUrl }])}</div>` : ""}` : ""}</div>`;
    const noteSources =
      key === focus && evidence.get(center.laureateId)?.mentorshipSources;
    if (noteSources?.length)
      $("lineage-inspector")
        .querySelector(".lineage-evidence")
        .insertAdjacentHTML(
          "beforeend",
          `<div class="evidence-links">${links(noteSources)}</div>`,
        );
  }
  function render(key, moveFocus = false) {
    const center = nodes.get(key);
    if (!center?.laureateId) return;
    focus = key;
    $("lineage-focus").value = key;
    const incoming = graph.edges.filter((edge) => edge.to === key);
    const outgoing = graph.edges.filter((edge) => edge.from === key);
    const unique = (edges) =>
      [
        ...new Set(
          edges.map((edge) => (edge.from === key ? edge.to : edge.from)),
        ),
      ].sort((a, b) => nodes.get(a).name.localeCompare(nodes.get(b).name));
    const left = unique(incoming),
      right = unique(outgoing);
    const rows = Math.max(left.length, right.length, 1);
    const height = Math.max(310, rows * 96 + 90);
    const positions = new Map([[key, { x: 450, y: height / 2 }]]);
    const place = (list, x) =>
      list.forEach((nodeKey, index) =>
        positions.set(nodeKey, {
          x,
          y: (height - (list.length - 1) * 96) / 2 + index * 96,
        }),
      );
    place(left, 145);
    place(right, 755);
    const lines = [...incoming, ...outgoing]
      .map((edge) => {
        const from = positions.get(edge.from),
          to = positions.get(edge.to);
        return `<path class="${edge.type === "dissertation committee" ? "committee-edge" : edge.type === "doctoral co-advisor" ? "coadvisor-edge" : ""}" d="M${from.x + 112} ${from.y} C${from.x + 155} ${from.y},${to.x - 155} ${to.y},${to.x - 112} ${to.y}" marker-end="url(#lineage-arrow)"><title>${escape(nodes.get(edge.from).name)} → ${escape(nodes.get(edge.to).name)}: ${escape(edge.type)}</title></path>`;
      })
      .join("");
    $("lineage-canvas").style.height = `${height}px`;
    $("lineage-canvas").innerHTML =
      `<svg class="lineage-lines" viewBox="0 0 900 ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="lineage-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>${lines}</svg><span class="network-column" style="left:16.11%">DOCTORAL ADVISERS / COMMITTEE</span><span class="network-column" style="left:50%">SELECTED LAUREATE</span><span class="network-column" style="left:83.89%">SELECTED PhD STUDENTS</span>${[
        ...positions.entries(),
      ]
        .map(([nodeKey, position]) => {
          const node = nodes.get(nodeKey),
            person = node.person;
          const edge = [...incoming, ...outgoing].find(
            (edge) => edge.from === nodeKey || edge.to === nodeKey,
          );
          const sublabel = node.laureateId
            ? `Nobel ${person.year}`
            : right.includes(nodeKey)
              ? edge?.phdYear
                ? `PhD ${edge.phdYear}`
                : "PhD student"
              : edge?.type || "Doctoral relationship";
          return `<button class="network-node ${nodeKey === key ? "network-center" : ""} ${node.laureateId ? "network-laureate" : ""}" data-node="${escape(nodeKey)}" style="left:${position.x / 9}%;top:${position.y}px" aria-pressed="false" aria-label="View ${escape(node.name)}${node.laureateId ? ", Nobel laureate" : ""}">${
            person?.portrait
              ? `<img src="${escape(person.portrait)}" alt="" loading="lazy">`
              : `<span class="network-initials" aria-hidden="true">${escape(
                  node.name
                    .split(/\s+/)
                    .filter((p) => p.length > 2)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join(""),
                )}</span>`
          }<span><strong>${escape(node.name)}</strong><small>${escape(sublabel)}</small></span></button>`;
        })
        .join(
          "",
        )}${!left.length ? '<p class="network-absence network-absence-left">No adviser link documented here yet.</p>' : ""}${!right.length ? '<p class="network-absence network-absence-right">No student link documented here yet.</p>' : ""}`;
    $("lineage-canvas")
      .querySelectorAll("img")
      .forEach((img) =>
        img.addEventListener("error", () => img.remove(), { once: true }),
      );
    inspect(key);
    const scroll = $("lineage-canvas").parentElement;
    scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2;
    $("lineage-shortcuts")
      .querySelectorAll("[data-focus]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.focus === key),
        ),
      );
    if (moveFocus) $("lineage-focus").focus({ preventScroll: true });
  }
  $("lineage-focus").addEventListener("change", () =>
    render($("lineage-focus").value),
  );
  $("lineage").addEventListener("click", (event) => {
    const focusButton = event.target.closest("[data-focus]");
    const nodeButton = event.target.closest("[data-node]");
    const profileButton = event.target.closest("[data-open-nobel]");
    if (focusButton) render(focusButton.dataset.focus, true);
    else if (nodeButton) inspect(nodeButton.dataset.node);
    else if (profileButton)
      document.dispatchEvent(
        new CustomEvent("nobel:profile", {
          detail: {
            id: profileButton.dataset.openNobel,
            trigger: profileButton,
          },
        }),
      );
  });
  document.addEventListener("nobel:lineage", (event) => {
    render(`nobel-${event.detail.id}`, true);
    $("lineage").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  });
  const solow = laureates.find(
    (node) => /Solow/.test(node.name) && degree(node.key),
  );
  render(solow?.key || connected[0]?.key || laureates[0]?.key);
})();
