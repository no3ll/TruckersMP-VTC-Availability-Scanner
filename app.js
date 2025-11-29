// Simple client-side viewer for vtcs_source.json

const busyInput = document.getElementById("busyVtcsInput");
const applyBtn = document.getElementById("applyFiltersBtn");
const resultsContainer = document.getElementById("resultsContainer");
const resultsSummary = document.getElementById("resultsSummary");

const filterVerified = document.getElementById("filterVerified");
const filterValidated = document.getElementById("filterValidated");
const filterNormal = document.getElementById("filterNormal");
const filterRecruitmentOpen = document.getElementById("filterRecruitmentOpen");

let VTC_DB = [];
let lastFilteredCount = 0;

// --- Utility helpers --------------------------------------------------------

function parseBusyIds(text) {
  const ids = new Set();
  if (!text) return ids;
  const matches = text.match(/\d{1,7}/g); // up to 7 digits
  if (!matches) return ids;
  for (const token of matches) {
    const n = Number.parseInt(token, 10);
    if (!Number.isNaN(n)) ids.add(n);
  }
  return ids;
}

function groupByStatus(vtcs) {
  const groups = {
    verified: [],
    validated: [],
    normal: [],
    unknown: [],
  };
  for (const vtc of vtcs) {
    const s = (vtc.status || "unknown").toLowerCase();
    if (s === "verified") groups.verified.push(vtc);
    else if (s === "validated") groups.validated.push(vtc);
    else if (s === "normal") groups.normal.push(vtc);
    else groups.unknown.push(vtc);
  }
  return groups;
}

function recruitmentIsOpen(vtc) {
  const r = (vtc.recruitment || "").toLowerCase();
  if (!r) return false;
  return r.includes("open");
}

// --- Rendering --------------------------------------------------------------

function createIconTMP() {
  const span = document.createElement("span");
  span.className = "pill-icon";
  span.innerHTML =
    "<svg viewBox='0 0 20 20'><path d='M2 11h1l2.2-5.5A1 1 0 0 1 6.1 5h7.8a1 1 0 0 1 .9.6L17 11h1a1 1 0 0 1 0 2h-1v1.5A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5V13H2a1 1 0 1 1 0-2Zm4.4-4L5 11h10l-1.4-4H6.4Z'/></svg>";
  return span;
}

function createIconDiscord() {
  const span = document.createElement("span");
  span.className = "pill-icon";
  span.innerHTML =
    "<svg viewBox='0 0 24 24'><path d='M20 4a4 4 0 0 0-2.82-1.76A14.89 14.89 0 0 0 14.17 2l-.34.68A13.12 13.12 0 0 0 9.8 2l-.35-.68a14.87 14.87 0 0 0-3-.24A4 4 0 0 0 3.64 4C2.34 7 2 10 2.16 13a4.83 4.83 0 0 0 1.61 3.34A10.42 10.42 0 0 0 7 18.41l.79-1.3A7.94 7.94 0 0 1 6 16.28l.36-.27a8.76 8.76 0 0 0 11.28 0l.36.27a7.94 7.94 0 0 1-1.84.83l.79 1.3a10.42 10.42 0 0 0 3.23-2.09A4.83 4.83 0 0 0 21.84 13C22 10 21.66 7 20 4ZM9.1 13.5c-.89 0-1.62-.82-1.62-1.82s.71-1.83 1.62-1.83S10.72 10.7 10.72 11.7 10 13.5 9.1 13.5Zm5.8 0c-.89 0-1.62-.82-1.62-1.82s.72-1.83 1.62-1.83 1.61.84 1.61 1.83-.72 1.82-1.61 1.82Z'/></svg>";
  return span;
}

function renderVtcCard(vtc) {
  const card = document.createElement("article");
  card.className = "vtc-card";

  // Logo
  const logoWrapper = document.createElement("div");
  logoWrapper.className = "vtc-logo";

  if (vtc.logo_url) {
    const img = document.createElement("img");
    img.src = vtc.logo_url;
    img.alt = `${vtc.name} logo`;
    logoWrapper.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.className = "vtc-logo-fallback";
    span.textContent = (vtc.name || "?").trim().charAt(0).toUpperCase();
    logoWrapper.appendChild(span);
  }

  // Main
  const main = document.createElement("div");
  main.className = "vtc-main";

  const nameRow = document.createElement("div");
  nameRow.className = "vtc-name-row";

  const nameEl = document.createElement("div");
  nameEl.className = "vtc-name";
  nameEl.textContent = vtc.name || "(Unnamed VTC)";

  const idEl = document.createElement("div");
  idEl.className = "vtc-id";
  idEl.textContent = `ID ${vtc.id ?? "?"}`;

  nameRow.appendChild(nameEl);
  nameRow.appendChild(idEl);

  const tagsRow = document.createElement("div");
  tagsRow.className = "vtc-tags";

  const statusTag = document.createElement("span");
  statusTag.className = "tag-pill tag-pill--status";
  const status = (vtc.status || "unknown").toUpperCase();
  statusTag.textContent = status;
  tagsRow.appendChild(statusTag);

  const recruit = vtc.recruitment || "";
  if (recruit) {
    const recruitTag = document.createElement("span");
    recruitTag.className = "tag-pill";
    if (recruitmentIsOpen(vtc)) {
      recruitTag.classList.add("tag-pill--recruit-open");
      recruitTag.textContent = "Recruitment: OPEN";
    } else {
      recruitTag.textContent = `Recruitment: ${recruit.toUpperCase()}`;
    }
    tagsRow.appendChild(recruitTag);
  }

  const linksRow = document.createElement("div");
  linksRow.className = "vtc-links";

  if (vtc.tmp_url || vtc.tmp_link) {
    const url = vtc.tmp_url || vtc.tmp_link;
    const link = document.createElement("a");
    link.className = "link-pill link-pill--tmp";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.appendChild(createIconTMP());
    link.appendChild(document.createTextNode("TMP profile"));
    linksRow.appendChild(link);
  }

  if (vtc.discord_url || vtc.discord) {
    const url = vtc.discord_url || vtc.discord;
    const link = document.createElement("a");
    link.className = "link-pill link-pill--discord";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.appendChild(createIconDiscord());
    link.appendChild(document.createTextNode("Discord"));
    linksRow.appendChild(link);
  }

  main.appendChild(nameRow);
  main.appendChild(tagsRow);
  if (linksRow.children.length > 0) {
    main.appendChild(linksRow);
  }

  card.appendChild(logoWrapper);
  card.appendChild(main);

  return card;
}

function renderGroups(groups) {
  resultsContainer.innerHTML = "";

  const order = [
    ["verified", "VERIFIED VTCS"],
    ["validated", "VALIDATED VTCS"],
    ["normal", "NORMAL VTCS"],
  ];

  let totalShown = 0;

  for (const [key, label] of order) {
    const list = groups[key];
    if (!list || list.length === 0) continue;

    totalShown += list.length;

    const groupEl = document.createElement("section");
    groupEl.className = "results-group";

    const header = document.createElement("div");
    header.className = "results-group-header";

    const title = document.createElement("div");
    title.className = "results-group-title";
    title.textContent = label;

    const count = document.createElement("div");
    count.className = "results-group-count";
    count.textContent = `${list.length} VTC(s)`;

    header.appendChild(title);
    header.appendChild(count);

    groupEl.appendChild(header);

    for (const vtc of list) {
      groupEl.appendChild(renderVtcCard(vtc));
    }

    resultsContainer.appendChild(groupEl);
  }

  if (totalShown === 0) {
    const empty = document.createElement("p");
    empty.className = "results-summary";
    empty.textContent =
      "No VTCs match your filters. Try unchecking some filters or clearing the busy list.";
    resultsContainer.appendChild(empty);
  }

  lastFilteredCount = totalShown;
}

// --- Filtering pipeline -----------------------------------------------------

function recompute() {
  if (!VTC_DB || VTC_DB.length === 0) {
    resultsSummary.textContent =
      "No VTC data loaded. Make sure vtcs_source.json is present next to this page.";
    resultsContainer.innerHTML = "";
    return;
  }

  const busyIds = parseBusyIds(busyInput.value);

  const statusFlags = {
    verified: filterVerified.checked,
    validated: filterValidated.checked,
    normal: filterNormal.checked,
  };
  const requireOpenRecruitment = filterRecruitmentOpen.checked;

  const filtered = VTC_DB.filter((vtc) => {
    if (!vtc || typeof vtc.id !== "number") return false;

    // Exclude busy
    if (busyIds.has(vtc.id)) return false;

    const status = (vtc.status || "normal").toLowerCase();
    if (status === "verified" && !statusFlags.verified) return false;
    if (status === "validated" && !statusFlags.validated) return false;
    if (status !== "verified" && status !== "validated" && !statusFlags.normal)
      return false;

    if (requireOpenRecruitment && !recruitmentIsOpen(vtc)) return false;

    return true;
  });

  // Sort inside groups by name
  filtered.sort((a, b) => {
    const sa = (a.status || "").toLowerCase();
    const sb = (b.status || "").toLowerCase();
    if (sa !== sb) {
      const order = { verified: 0, validated: 1, normal: 2, unknown: 3 };
      return (order[sa] ?? 3) - (order[sb] ?? 3);
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  const groups = groupByStatus(filtered);
  renderGroups(groups);

  const busyCount = busyIds.size;
  resultsSummary.textContent = `Showing ${lastFilteredCount} VTC(s) after filtering. Busy list contains ${busyCount} ID(s).`;
}

// --- Data loading -----------------------------------------------------------

async function loadVtcsJson() {
  const candidates = ["vtcs_source.json", "../vtcs_source.json"];

  for (const path of candidates) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;
      VTC_DB = data;
      resultsSummary.textContent = `Loaded ${VTC_DB.length} VTC(s) from vtcs_source.json. Paste busy IDs and apply filters to get suggestions.`;
      recompute();
      return;
    } catch (err) {
      // Try next candidate
    }
  }

  resultsSummary.textContent =
    "Could not load vtcs_source.json. Place it in the same folder as this page or one level above.";
}

// --- Event wiring -----------------------------------------------------------

applyBtn.addEventListener("click", recompute);

for (const cb of [
  filterVerified,
  filterValidated,
  filterNormal,
  filterRecruitmentOpen,
]) {
  cb.addEventListener("change", recompute);
}

// Re-filter as user types, but debounced a bit
let busyDebounce = null;
busyInput.addEventListener("input", () => {
  if (busyDebounce) clearTimeout(busyDebounce);
  busyDebounce = setTimeout(recompute, 350);
});

loadVtcsJson();
