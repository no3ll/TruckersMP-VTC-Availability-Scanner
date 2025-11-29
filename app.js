// Simple front-end viewer for vtcs_source.json
// Assumes vtcs_source.json is in the same directory as index.html

let allVtcs = [];

async function loadVtcs() {
  const statusMessage = document.getElementById("statusMessage");
  try {
    statusMessage.textContent = "Loading vtcs_source.json...";
    const response = await fetch("vtcs_source.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("vtcs_source.json must be an array of VTC objects");
    }
    allVtcs = data;
    statusMessage.textContent = `Loaded ${allVtcs.length} VTCs from vtcs_source.json.`;
  } catch (err) {
    console.error(err);
    statusMessage.textContent =
      "Error loading vtcs_source.json. Check that it exists in the repo root.";
  }
}

function parseBusyIds(raw) {
  if (!raw) return new Set();
  const parts = raw
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const ids = new Set();
  for (const p of parts) {
    const num = parseInt(p, 10);
    if (!Number.isNaN(num)) ids.add(num);
  }
  return ids;
}

function groupAndRender() {
  const busyRaw = document.getElementById("busyIdsInput").value;
  const busyIds = parseBusyIds(busyRaw);

  const statusCheckboxes = Array.from(
    document.querySelectorAll(".status-filter")
  );
  const allowedStatuses = new Set(
    statusCheckboxes
      .filter((cb) => cb.checked)
      .map((cb) => cb.value.toLowerCase())
  );

  const recruitmentOpenOnly = document.getElementById(
    "recruitmentOpenOnly"
  ).checked;

  const resultsContainer = document.getElementById("resultsContainer");
  resultsContainer.innerHTML = "";

  if (!allVtcs.length) {
    const msg = document.createElement("p");
    msg.className = "help-text";
    msg.textContent =
      "No VTCs loaded yet. Make sure vtcs_source.json exists and reloaded the page.";
    resultsContainer.appendChild(msg);
    return;
  }

  // Filter
  const filtered = allVtcs.filter((vtc) => {
    const id = Number(vtc.id);
    if (busyIds.has(id)) return false;

    const status =
      (vtc.status || "normal").toString().toLowerCase().trim();
    if (!allowedStatuses.has(status)) return false;

    const recruitment = (vtc.recruitment || "").toString().toUpperCase();
    if (recruitmentOpenOnly && recruitment !== "OPEN") return false;

    return true;
  });

  // Group by status
  const groups = {
    verified: [],
    validated: [],
    normal: [],
  };

  for (const v of filtered) {
    const status = (v.status || "normal").toLowerCase();
    if (status === "verified") groups.verified.push(v);
    else if (status === "validated") groups.validated.push(v);
    else groups.normal.push(v);
  }

  // Sort each group alphabetically by name
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      })
    );
  }

  const order = [
    ["verified", "Verified VTCs", "group-title--verified"],
    ["validated", "Validated VTCs", "group-title--validated"],
    ["normal", "Normal VTCs", "group-title--normal"],
  ];

  let totalCount = 0;

  for (const [key, label, className] of order) {
    const list = groups[key];
    if (!list.length) continue;
    totalCount += list.length;

    const groupBlock = document.createElement("div");
    groupBlock.className = "group-block";

    const title = document.createElement("h3");
    title.className = `group-title ${className}`;
    title.innerHTML = `
      ${label}
      <span class="group-pill">${list.length} VTC(s)</span>
    `;
    groupBlock.appendChild(title);

    const vtcList = document.createElement("div");
    vtcList.className = "vtc-list";

    for (const vtc of list) {
      const card = document.createElement("article");
      card.className = "vtc-card";

      const header = document.createElement("div");
      header.className = "vtc-header";

      const nameSpan = document.createElement("span");
      nameSpan.className = "vtc-name";
      nameSpan.textContent = vtc.name || `VTC ${vtc.id}`;

      const idSpan = document.createElement("span");
      idSpan.className = "vtc-id";
      idSpan.textContent = `ID ${vtc.id}`;

      header.appendChild(nameSpan);
      header.appendChild(idSpan);
      card.appendChild(header);

      const meta = document.createElement("div");
      meta.className = "vtc-meta";

      // TMP link
      const tmpLink = document.createElement("a");
      tmpLink.href = `https://truckersmp.com/vtc/${vtc.id}`;
      tmpLink.target = "_blank";
      tmpLink.rel = "noopener noreferrer";
      tmpLink.textContent = "TMP profile";
      meta.appendChild(tmpLink);

      // Discord link (if present)
      if (vtc.discord) {
        const discordLink = document.createElement("a");
        discordLink.href = vtc.discord;
        discordLink.target = "_blank";
        discordLink.rel = "noopener noreferrer";
        discordLink.textContent = "Discord";
        meta.appendChild(discordLink);
      }

      // Recruitment badge
      const recruitment = (vtc.recruitment || "").toUpperCase();
      if (recruitment) {
        const badge = document.createElement("span");
        badge.className =
          "badge" + (recruitment === "OPEN" ? " badge--open" : "");
        badge.textContent = `Recruitment: ${recruitment}`;
        meta.appendChild(badge);
      }

      card.appendChild(meta);
      vtcList.appendChild(card);
    }

    groupBlock.appendChild(vtcList);
    resultsContainer.appendChild(groupBlock);
  }

  if (!totalCount) {
    const msg = document.createElement("p");
    msg.className = "help-text";
    msg.textContent =
      "No VTCs match your filters (or everything is busy). Try clearing the busy IDs or relaxing filters.";
    resultsContainer.appendChild(msg);
  }

  const statusMessage = document.getElementById("statusMessage");
  statusMessage.textContent = `Showing ${totalCount} VTC(s) after filtering.`;
}

document.addEventListener("DOMContentLoaded", () => {
  loadVtcs();

  const btn = document.getElementById("applyFiltersBtn");
  btn.addEventListener("click", groupAndRender);

  // Also re-run when status / recruitment filters change
  document
    .querySelectorAll(".status-filter, #recruitmentOpenOnly")
    .forEach((el) => {
      el.addEventListener("change", groupAndRender);
    });
});
