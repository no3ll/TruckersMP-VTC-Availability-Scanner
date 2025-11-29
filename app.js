// Frontend for TruckersMP VTC Availability Helper
// Calls a backend API that does the scraping + filtering.

// TODO: change this to your real deployed backend URL.
const BACKEND_URL = "https://vtc-api.onrender.com"; // <--- REPLACE

function getFiltersFromUI() {
  return {
    verified: document.getElementById("filter-verified").checked,
    validated: document.getElementById("filter-validated").checked,
    normal: document.getElementById("filter-normal").checked,
    recruitmentOpenOnly: document.getElementById("filter-recruitment-open").checked,
  };
}

function parseEventUrls(raw) {
  if (!raw) return [];
  return raw
    .split(/[\n\r, ]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

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

function renderSummary(counts, hadError) {
  const summary = document.getElementById("summary-text");
  const statsChip = document.getElementById("stats-chip");

  if (!counts) {
    summary.textContent = "Waiting for event links. No scan has been run yet.";
    statsChip.classList.add("hidden");
    return;
  }

  let txt = `Scanned ${counts.events_scanned} event(s). Found ${counts.busy_vtcs} busy VTC ID(s). Showing ${counts.invite_ready_vtcs} invite-ready VTC(s) out of ${counts.total_vtcs_in_db} total.`;
  if (hadError) {
    txt += " Some errors occurred while contacting the backend.";
  }
  summary.textContent = txt;

  if (counts.invite_ready_vtcs > 0) {
    statsChip.textContent = `${counts.invite_ready_vtcs} invite-ready VTC${
      counts.invite_ready_vtcs === 1 ? "" : "s"
    }`;
    statsChip.classList.remove("hidden");
  } else {
    statsChip.classList.add("hidden");
  }
}

function renderResults(vtcs) {
  const container = document.getElementById("results-container");
  container.innerHTML = "";

  if (!vtcs || vtcs.length === 0) {
    const p = document.createElement("p");
    p.className = "panel-subtitle";
    p.textContent =
      "No VTCs matched your filters. Try changing the filters or checking your event links.";
    container.appendChild(p);
    return;
  }

  const grouped = groupByStatus(vtcs);

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
      const members =
        vtc.members != null && vtc.members !== ""
          ? `• ${vtc.members} member(s)`
          : "";
      const games = vtc.games
        ? `• ${String(vtc.games).toUpperCase().replace(/,/g, " / ")}`
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

async function runScan() {
  const raw = document.getElementById("event-links-input").value;
  const eventUrls = parseEventUrls(raw);
  const summary = document.getElementById("summary-text");

  if (!eventUrls.length) {
    summary.textContent =
      "Please paste at least one TruckersMP event link (e.g. https://truckersmp.com/events/30724-...).";
    renderResults([]);
    renderSummary(null, false);
    return;
  }

  const filters = getFiltersFromUI();

  summary.textContent = "Contacting backend and scanning events...";
  renderResults([]);

  let hadError = false;
  let data = null;

  try {
    const res = await fetch(`${BACKEND_URL}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_urls: eventUrls, filters }),
    });

    if (!res.ok) {
      hadError = true;
      const msg = await res.text();
      console.error("Backend error:", res.status, msg);
    } else {
      data = await res.json();
    }
  } catch (err) {
    hadError = true;
    console.error("Request failed:", err);
  }

  if (!data) {
    summary.textContent =
      "Could not get a valid response from the backend. Please check the backend URL or try again later.";
    renderResults([]);
    document.getElementById("stats-chip").classList.add("hidden");
    return;
  }

  renderSummary(data.counts, hadError);
  renderResults(data.invite_vtcs);
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("scan-btn");
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    runScan();
  });
});
