// TruckersMP VTC Availability Helper frontend logic
// Loads vtcs_source.json, parses busy IDs from the textarea, applies filters,
// and renders grouped VTC cards.

const VTC_STATUS_ORDER = {
  verified: 0,
  validated: 1,
  normal: 2,
};

let allVtcs = [];

/**
 * Parse busy VTC IDs from the textarea.
 * Accepts comma/space/newline separated lists.
 */
function parseBusyIds(raw) {
  if (!raw) return new Set();
  const ids = raw
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && /^\d+$/.test(token))
    .map((token) => Number(token));

  return new Set(ids);
}

/**
 * Apply filters to the global VTC list and return a new filtered array.
 */
function filterVtcs(busyIdSet, filters) {
  return allVtcs.filter((vtc) => {
    const id = Number(vtc.id);

    if (busyIdSet.has(id)) return false;

    const status = (vtc.status || "normal").toLowerCase();
    if (status === "verified" && !filters.verified) return false;
    if (status === "validated" && !filters.validated) return false;
    if (status === "normal" && !filters.normal) return false;

    if (filters.recruitmentOpenOnly) {
      const recruitment = (vtc.recruitment || "").toUpperCase();
      if (recruitment !== "OPEN") return false;
    }

    return true;
  });
}

/**
 * Sort VTCs by status group, then by member count (descending),
 * then by name.
 */
function sortVtcs(vtcs) {
  return [...vtcs].sort((a, b) => {
    const statusA = (a.status || "normal").toLowerCase();
    const statusB = (b.status || "normal").toLowerCase();

    const rankA = VTC_STATUS_ORDER[statusA] ?? 99;
    const rankB = VTC_STATUS_ORDER[statusB] ?? 99;
    if (rankA !== rankB) return rankA - rankB;

    const membersA = Number(a.members || 0);
    const membersB = Number(b.members || 0);
    if (membersA !== membersB) return membersB - membersA;

    const nameA = (a.name || "").toLowerCase();
    const nameB = (b.name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Group VTCs by status for nicer UI sections.
 */
function groupByStatus(vtcs) {
  const groups = { verified: [], validated: [], normal: [] };
  vtcs.forEach((vtc) => {
    const status = (vtc.status || "normal").toLowerCase();
    if (status === "verified") groups.verified.push(vtc);
    else if (status === "validated") groups.validated.push(vtc);
    else groups.normal.push(vtc);
  });
  return groups;
}

/**
 * Render the stats chip & summary text.
 */
function renderSummary(filtered, busyIdSet) {
  const summaryText = document.getElementById("summary-text");
  const statsChip = document.getElementById("stats-chip");

  const total = allVtcs.length;
  const filteredCount = filtered.length;
  const busyCount = busyIdSet.size;

  summaryText.textContent = `Showing ${filteredCount} VTC(s) after filtering. Busy list contains ${busyCount} ID(s).`;

  if (filteredCount > 0) {
    statsChip.classList.remove("hidden");
    statsChip.textContent = `${filteredCount} invite-ready VTC${
      filteredCount === 1 ? "" : "s"
    }`;
  } else {
    statsChip.classList.add("hidden");
  }
}

/**
 * Render VTC cards into the right-hand list.
 */
function renderResults(filtered) {
  const container = document.getElementById("results-container");
  container.innerHTML = "";

  if (!filtered.length) {
    const p = document.createElement("p");
    p.textContent =
      "No VTCs matched your filters. Try unchecking some filters or checking your busy ID list.";
    p.className = "panel-subtitle";
    container.appendChild(p);
    return;
  }

  const grouped = groupByStatus(filtered);

  function renderGroup(title, list, statusKey) {
    if (!list.length) return;

    const header = document.createElement("div");
    header.className = "vtc-group-header";
    header.textContent = `${title} (${list.length} VTC${
      list.length === 1 ? "" : "s"
    })`;
    container.appendChild(header);

    list.forEach((vtc) => {
      const card = document.createElement("div");
      card.className = "vtc-card";

      // Left side: logo + text
      const main = document.createElement("div");
      main.className = "vtc-main";

      const logo = document.createElement("div");
      logo.className = "vtc-logo";

      if (vtc.logo) {
        const img = document.createElement("img");
        img.src = vtc.logo;
        img.alt = `${vtc.name} logo`;
        logo.appendChild(img);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "vtc-logo-fallback";
        fallback.textContent = (vtc.name || "VTC").slice(0, 3).toUpperCase();
        logo.appendChild(fallback);
      }

      const textBlock = document.createElement("div");
      textBlock.className = "vtc-text-block";

      const nameRow = document.createElement("div");
      nameRow.className = "vtc-name-row";

      const name = document.createElement("div");
      name.className = "vtc-name";
      name.textContent = vtc.name || "Unnamed VTC";

      const idSpan = document.createElement("div");
      idSpan.className = "vtc-id";
      idSpan.textContent = `ID ${vtc.id}`;

      nameRow.appendChild(name);
      nameRow.appendChild(idSpan);
      textBlock.appendChild(nameRow);

      const secondary = document.createElement("div");
      secondary.className = "vtc-secondary-line";
      const members = vtc.members != null ? `• ${vtc.members} member(s)` : "";
      const games = vtc.games
        ? `• ${vtc.games.toUpperCase().replace(/,/g, " / ")}`
        : "";
      secondary.textContent = [members, games].filter(Boolean).join(" ");
      textBlock.appendChild(secondary);

      const badgesRow = document.createElement("div");
      badgesRow.className = "badges-row";

      const statusBadge = document.createElement("span");
      statusBadge.className = `badge badge-status-${statusKey}`;
      statusBadge.textContent = statusKey.toUpperCase();
      badgesRow.appendChild(statusBadge);

      if ((vtc.recruitment || "").toUpperCase() === "OPEN") {
        const recBadge = document.createElement("span");
        recBadge.className = "badge badge-recruit-open";
        recBadge.textContent = "RECRUITMENT: OPEN";
        badgesRow.appendChild(recBadge);
      }

      textBlock.appendChild(badgesRow);

      main.appendChild(logo);
      main.appendChild(textBlock);

      // Right side: icons
      const actions = document.createElement("div");
      actions.className = "vtc-actions";

      if (vtc.tmp_url) {
        const tmpLink = document.createElement("a");
        tmpLink.href = vtc.tmp_url;
        tmpLink.target = "_blank";
        tmpLink.rel = "noreferrer";
        tmpLink.className = "icon-link";
        tmpLink.title = "Open TruckersMP profile";
        const span = document.createElement("span");
        span.textContent = "TMP";
        tmpLink.appendChild(span);
        actions.appendChild(tmpLink);
      }

      if (vtc.discord) {
        const discLink = document.createElement("a");
        discLink.href = vtc.discord;
        discLink.target = "_blank";
        discLink.rel = "noreferrer";
        discLink.className = "icon-link";
        discLink.title = "Open Discord invite";
        const span = document.createElement("span");
        span.textContent = "DC";
        discLink.appendChild(span);
        actions.appendChild(discLink);
      }

      card.appendChild(main);
      card.appendChild(actions);

      container.appendChild(card);
    });
  }

  renderGroup("Verified VTCs", grouped.verified, "verified");
  renderGroup("Validated VTCs", grouped.validated, "validated");
  renderGroup("Normal VTCs", grouped.normal, "normal");
}

/**
 * Load vtcs_source.json on page load.
 */
async function loadVtcs() {
  try {
    const res = await fetch("vtcs_source.json", { cache: "no-store" });
    if (!res.ok) {
      console.error("Failed to load vtcs_source.json", res.status);
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      allVtcs = data;
    } else if (Array.isArray(data.vtcs)) {
      allVtcs = data.vtcs;
    } else {
      console.error("Unexpected JSON structure in vtcs_source.json");
      allVtcs = [];
    }
  } catch (err) {
    console.error("Error loading vtcs_source.json", err);
    allVtcs = [];
  }
}

/**
 * Main initialization.
 */
document.addEventListener("DOMContentLoaded", async () => {
  await loadVtcs();

  const busyInput = document.getElementById("busy-ids-input");
  const btn = document.getElementById("apply-filters-btn");

  function runFiltering() {
    const busySet = parseBusyIds(busyInput.value);

    const filters = {
      verified: document.getElementById("filter-verified").checked,
      validated: document.getElementById("filter-validated").checked,
      normal: document.getElementById("filter-normal").checked,
      recruitmentOpenOnly: document.getElementById("filter-recruitment-open").checked,
    };

    const filtered = sortVtcs(filterVtcs(busySet, filters));
    renderSummary(filtered, busySet);
    renderResults(filtered);
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    runFiltering();
  });

  // Run once with default filters in case user wants to browse all
  runFiltering();
});
