// Set this to your Render backend URL
const API_BASE = "https://truckersmp-vtc-availability-scanner-api.onrender.com";

const eventTextarea = document.getElementById("event-urls");
const scanBtn = document.getElementById("scan-btn");
const errorBox = document.getElementById("error-box");
const summaryEl = document.getElementById("summary");
const resultsEl = document.getElementById("results");

function getStatusFilter() {
  const checked = document.querySelector('input[name="status-filter"]:checked');
  return checked ? checked.value : "verified_validated";
}

function getRecruitmentFilter() {
  const checked = document.querySelector('input[name="recruitment-filter"]:checked');
  return checked ? checked.value : "open";
}

function parseEventUrls(raw) {
  return raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function setLoading(isLoading) {
  if (isLoading) {
    scanBtn.classList.add("loading");
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning events...";
  } else {
    scanBtn.classList.remove("loading");
    scanBtn.disabled = false;
    scanBtn.textContent = "Scan events for free VTCs";
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function statusClass(status) {
  const s = (status || "").toLowerCase();
  if (s === "verified") return "status-pill status-verified";
  if (s === "validated") return "status-pill status-validated";
  return "status-pill status-normal";
}

function statusLabel(status) {
  const s = (status || "").toLowerCase();
  if (s === "verified") return "Verified";
  if (s === "validated") return "Validated";
  return "Normal";
}

function createVtcCard(vtc) {
  const card = document.createElement("div");
  card.className = "vtc-card";

  const logoContainer = document.createElement("div");
  logoContainer.className = "vtc-logo";

  if (vtc.logo) {
    const img = document.createElement("img");
    img.src = vtc.logo;
    img.alt = vtc.name;
    logoContainer.appendChild(img);
  } else {
    const initials = document.createElement("span");
    const words = vtc.name.split(" ");
    if (words.length === 1) {
      initials.textContent = words[0].slice(0, 2).toUpperCase();
    } else {
      initials.textContent = (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
    }
    logoContainer.appendChild(initials);
  }

  const main = document.createElement("div");
  main.className = "vtc-main";

  const nameRow = document.createElement("div");
  nameRow.className = "vtc-name-row";

  const nameEl = document.createElement("div");
  nameEl.className = "vtc-name";
  nameEl.textContent = vtc.name;

  const statusEl = document.createElement("span");
  statusEl.className = statusClass(vtc.status);
  statusEl.textContent = statusLabel(vtc.status);

  const recruitEl = document.createElement("span");
  if (vtc.recruitment && vtc.recruitment.toUpperCase() === "OPEN") {
    recruitEl.className = "recruit-pill";
    recruitEl.textContent = "Recruitment open";
  }

  nameRow.appendChild(nameEl);
  nameRow.appendChild(statusEl);
  if (recruitEl.className) {
    nameRow.appendChild(recruitEl);
  }

  const metaEl = document.createElement("div");
  metaEl.className = "vtc-meta";
  metaEl.textContent = `VTC ID ${vtc.id}`;

  main.appendChild(nameRow);
  main.appendChild(metaEl);

  const links = document.createElement("div");
  links.className = "vtc-links";

  // TMP link chip
  const tmpChip = document.createElement("a");
  tmpChip.className = "link-chip";
  tmpChip.href = vtc.tmp_url;
  tmpChip.target = "_blank";
  tmpChip.rel = "noopener noreferrer";
  tmpChip.title = "TruckersMP VTC page";
  tmpChip.textContent = "TMP";
  links.appendChild(tmpChip);

  // Discord chip
  if (vtc.discord) {
    const discChip = document.createElement("a");
    discChip.className = "link-chip";
    discChip.href = vtc.discord;
    discChip.target = "_blank";
    discChip.rel = "noopener noreferrer";
    discChip.title = "Discord invite";
    discChip.textContent = "DC";
    links.appendChild(discChip);
  }

  card.appendChild(logoContainer);
  card.appendChild(main);
  card.appendChild(links);

  return card;
}

function renderResults(data) {
  const free = data.free_vtcs || [];
  const busy = data.busy_vtc_ids || [];

  if (!free.length) {
    summaryEl.textContent =
      "No free VTCs found for those events and filters. Try loosening filters or checking other dates.";
    resultsEl.innerHTML = "";
    return;
  }

  summaryEl.textContent = `Found ${free.length} free VTC(s) out of ${data.total_vtcs_in_db} in the database. Busy VTCs detected from events: ${busy.length}.`;

  resultsEl.innerHTML = "";

  free.forEach((vtc) => {
    const card = createVtcCard(vtc);
    resultsEl.appendChild(card);
  });
}

async function runScan() {
  clearError();

  const raw = eventTextarea.value;
  const urls = parseEventUrls(raw);

  if (!urls.length) {
    showError("Please paste at least one TruckersMP event URL.");
    return;
  }

  const statusFilter = getStatusFilter();
  const recruitmentFilter = getRecruitmentFilter();

  const payload = {
    event_urls: urls,
    status_filter: statusFilter,
    recruitment_filter: recruitmentFilter,
  };

  setLoading(true);

  try {
    const resp = await fetch(`${API_BASE}/api/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("API error:", resp.status, text);
      showError(`API error: ${resp.status} — ${text || "Unknown error"}`);
      setLoading(false);
      return;
    }

    const data = await resp.json();
    renderResults(data);
  } catch (err) {
    console.error(err);
    showError("Failed to contact the API. Check your internet connection or try again later.");
  } finally {
    setLoading(false);
  }
}

// Wire up button
scanBtn.addEventListener("click", runScan);

// Allow Ctrl+Enter to trigger scan inside textarea
eventTextarea.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    runScan();
  }
});
