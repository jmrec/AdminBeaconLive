//@flow
/** @typedef {import('chart.js').Chart} Chart */
/** @typedef {import('leaflet')} L */

/* global Chart, L, supabase, jspdf */

/**
 * @file DASHBOARD.JS
 * @description Core dashboard logic for Project Beacon. Handles real-time outage heatmaps,
 * statistical analysis via Chart.js, predictive risk forecasting, and PDF reporting.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- Global State ---
  
  /** @type {Date} The current start date for dashboard filtering (Default: 30 days ago) */
  let currentEndDate = new Date();
  /** @type {Date} The current end date for dashboard filtering (Default: Today) */
  let currentStartDate = new Date();
  currentStartDate.setDate(currentEndDate.getDate() - 30);

  // --- Global Chart Instances ---
  /** @type {Chart|null} Instance for the Feeder distribution pie chart */
  let feederChartInstance = null;
  /** @type {Chart|null} Instance for the Restoration time bar chart */
  let restorationChartInstance = null;
  /** @type {Chart|null} Instance for the Root Cause horizontal bar chart */
  let rootCauseInstance = null;
  /** @type {Chart|null} Instance for the Barangay impact bar chart */
  let barangayImpactInstance = null;
  /** @type {Chart|null} Instance for the Peak time bubble chart */
  let peakTimeInstance = null;
  /** @type {Chart|null} Instance for the MTTR trend line chart */
  let mttrTrendInstance = null;

  // Forecast chart instances
  /** @type {Chart|null} Instance for the Feeder forecast chart */
  let feederForecastInstance = null;
  /** @type {Chart|null} Instance for the Barangay forecast chart */
  let barangayForecastInstance = null;
  /** @type {Chart|null} Instance for the Restoration forecast chart */
  let restorationForecastInstance = null;

  // --- DOM Elements ---
  const pieCanvas: ?HTMLCanvasElement = document.getElementById("feederChartCanvas");
  const barCanvas: ?HTMLCanvasElement = document.getElementById("restorationChartCanvas");
  const reportsTableBody: ?HTMLElement = document.getElementById("reportsBody");

  // Forecast DOM
  const feederForecastSummary: ?HTMLElement = document.getElementById("feederForecastSummary");
  const barangayForecastSummary: ?HTMLElement = document.getElementById("barangayForecastSummary");
  const restorationForecastSummary: ?HTMLElement = document.getElementById("restorationForecastSummary");
  const feederRiskList: ?HTMLElement = document.getElementById("feederRiskList");
  const barangayRiskList: ?HTMLElement = document.getElementById("barangayRiskList");
  const overallRiskBadge: ?HTMLElement = document.getElementById("overallRiskBadge");
  const forecastFeederUpdated: ?HTMLElement = document.getElementById("forecastFeederUpdated");
  const forecastBarangayUpdated: ?HTMLElement = document.getElementById("forecastBarangayUpdated");
  const forecastRestorationUpdated: ?HTMLElement = document.getElementById("forecastRestorationUpdated");

  // Date Filter Elements
  const dateRangeBtn: ?HTMLElement = document.getElementById("dateRangeBtn");
  const dateRangeDropdown: ?HTMLElement = document.getElementById("dateRangeDropdown");
  /** @type {HTMLInputElement | null} */
  const rangeStartInput: ?HTMLInputElement = (/** @type {HTMLInputElement} */ (document.getElementById("rangeStart")));

  /** @type {HTMLInputElement | null} */
  const rangeEndInput: ?HTMLInputElement = (/** @type {HTMLInputElement} */ (document.getElementById("rangeEnd")));

  const applyDateRangeBtn: ?HTMLElement = document.getElementById("applyDateRangeBtn");
  const dateRangeLabel: ?HTMLElement = document.getElementById("dateRangeLabel");

  if (rangeStartInput instanceof HTMLInputElement && rangeEndInput instanceof HTMLInputElement) {
    rangeStartInput.value = currentStartDate.toISOString().split("T")[0];
    rangeEndInput.value = currentEndDate.toISOString().split("T")[0];
    updateDateLabel();
  }

  /**
   * Updates the UI label showing the currently selected date range.
   */
  function updateDateLabel() {
    if (dateRangeLabel && rangeStartInput && rangeEndInput) {
      dateRangeLabel.textContent = `${rangeStartInput.value} - ${rangeEndInput.value}`;
    }
  }

  // 1. MAP HEATMAP LOGIC
  const map = L.map("map").setView([16.4023, 120.5960], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  /** @type {L.heatLayer|null} Leaflet heatmap layer instance */
  let heatLayer = null;
  /** @type {string} Current filter for the heatmap ('pending', 'reportedongoing', or 'all') */
  let heatFilter = "pending"; 
  /** @type {boolean} Whether the heatmap should respect the global date range */
  let heatmapUseDateRange = false;

  const heatFilterLabel = document.querySelector("#heatmapFilterBtn span:nth-child(4)");
  if (heatFilterLabel) heatFilterLabel.textContent = "Pending only";

  /**
   * Fetches coordinates from both 'reports' and 'announcements' tables to update the Leaflet heatmap.
   * Runs immediately on load and then every 30 seconds.
   * @async
   */
  async function fetchHeatmapData() {
    let heatPoints: Array<[number, number, number]> = [];
    const STATUS_WEIGHT = { pending: 1.5, reported: 2, ongoing: 3 };

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    try {
      // 1. Fetch PENDING reports
      if (heatFilter === "pending" || heatFilter === "all") {
        let reportsQuery = supabase
          .from("reports")
          .select("latitude, longitude, status")
          .in("status", ["Pending", "pending", "New", "new", "Open", "open"]);
        if (heatmapUseDateRange) {
          reportsQuery = reportsQuery.gte("created_at", sDate).lte("created_at", eDate);
        }
        const { data: reportsData, error: reportsError } = await reportsQuery; 

        if (!reportsError && reportsData) {
          const points = reportsData
            .filter((r) => r.latitude && r.longitude)
            .map((r) => [Number(r.latitude), Number(r.longitude), STATUS_WEIGHT.pending]);
          heatPoints = heatPoints.concat(points);
        }
      }

      // 2. Fetch REPORTED/ONGOING
      if (heatFilter === "reportedongoing" || heatFilter === "all") {
        let annQuery = supabase
          .from("announcements")
          .select("latitude, longitude, status")
          .in("status", ["Ongoing", "Reported"]);
        if (heatmapUseDateRange) {
          annQuery = annQuery.gte("created_at", sDate).lte("created_at", eDate);
        }
        const { data: annData, error: annError } = await annQuery;

        if (!annError && annData) {
          const points = annData
            .filter((r) => r.latitude && r.longitude)
            .map((r) => [
              Number(r.latitude), 
              Number(r.longitude), 
              STATUS_WEIGHT[r.status.toLowerCase()] || 2
            ]);
          heatPoints = heatPoints.concat(points);
        }
      }

      if (heatLayer) heatLayer.remove();
      if (heatPoints.length > 0) {
        heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15, maxZoom: 15 }).addTo(map);
      }
    } catch (err) {
      console.error("Error updating heatmap", err);
    }
  }

  fetchHeatmapData();
  setInterval(fetchHeatmapData, 30000);

  // --- HEATMAP UI EVENTS ---
  const hFilterBtn = document.getElementById("heatmapFilterBtn");
  const hFilterPopup = document.getElementById("heatmapFilterPopup");
  const hFilterRadios = hFilterPopup ? hFilterPopup.querySelectorAll("input[name='heatmapFilter']") : [];
  const hUseRangeCheckbox = hFilterPopup ? hFilterPopup.querySelector("#heatmapUseDateRange") : null;

  if (hFilterBtn) {
    hFilterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hFilterPopup.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!hFilterBtn.contains(e.target) && !hFilterPopup.contains(e.target)) {
        hFilterPopup.classList.add("hidden");
      }
    });

    hFilterRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        heatFilter = e.target.value;
        const labelText = e.target.nextElementSibling.textContent;
        const spans = hFilterBtn.querySelectorAll("span");
        if (spans.length >= 4) spans[3].textContent = labelText;
        fetchHeatmapData();
        hFilterPopup.classList.add("hidden");
      });
    });

    if (hUseRangeCheckbox) {
      hUseRangeCheckbox.addEventListener("change", (e) => {
        heatmapUseDateRange = e.target.checked;
        fetchHeatmapData();
      });
    }
  }

  // 2. DATE RANGE FILTER EVENTS
  if (dateRangeBtn instanceof HTMLElement && dateRangeDropdown instanceof HTMLElement) {
    dateRangeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dateRangeDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!dateRangeBtn.contains(e.target) && !dateRangeDropdown.contains(e.target)) {
        dateRangeDropdown.classList.add("hidden");
      }
    });
  }

  if (
    applyDateRangeBtn && 
    dateRangeDropdown instanceof HTMLElement &&
    rangeStartInput instanceof HTMLInputElement && 
    rangeEndInput instanceof HTMLInputElement
  ) {
    applyDateRangeBtn.addEventListener("click", () => {
      const sVal = rangeStartInput.value;
      const eVal = rangeEndInput.value;
      
      if (sVal && eVal) {
        currentStartDate = new Date(sVal);
        currentEndDate = new Date(eVal);
        updateDateLabel();

        dateRangeDropdown.classList.add("hidden");
        
        refreshAllData();
      }
    });
  }

  /**
   * Orchestrates a full refresh of all dashboard data components.
   * @async
   */
  async function refreshAllData() {
    await Promise.all([
      loadDashboardStats(),
      updateFeederChart(),
      updateRestorationChart(),
      loadAdvancedAnalytics(),
      loadRecentReports()
    ]);
  }

  /**
   * Helper to format a Date object into YYYY-MM-DD string.
   * @param {Date} d - The date to format.
   * @returns {string} ISO date string (date part only).
   */
  const toISODate = (d: Date) => d.toISOString().split("T")[0];

  /**
   * Fetches high-level summary statistics (Total, Active, Completed) 
   * and calculates percentage trends compared to the previous period.
   * @async
   */
  async function loadDashboardStats() {
    if (!window.supabase) return;

    try {
      const sDateStr = toISODate(currentStartDate);
      const eDateStr = toISODate(currentEndDate);

      const targetStart = `${sDateStr}T00:00:00Z`;
      const targetEnd = `${eDateStr}T23:59:59Z`;

      const diffTime = Math.abs(currentEndDate.getTime() - currentStartDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
      
      const prevEndObj = new Date(currentStartDate);
      prevEndObj.setDate(prevEndObj.getDate() - 1);
      const prevStartObj = new Date(prevEndObj);
      prevStartObj.setDate(prevStartObj.getDate() - diffDays + 1);

      const compareStart = `${toISODate(prevStartObj)}T00:00:00Z`;
      const compareEnd = `${toISODate(prevEndObj)}T23:59:59Z`;

      async function getCount(
        table: string, 
        statusCol: ?string, 
        statusVal: ?string, 
        dateCol: string, 
        start: string, 
        end: string
      ): Promise<number> {
        let query = supabase.from(table).select("id", { count: "exact", head: true });
        if (statusCol && statusVal) query = query.eq(statusCol, statusVal);
        query = query.gte(dateCol, start).lte(dateCol, end);
        const { count, error } = await query;
        return count || 0;
      };

      async function getCountMultipleStatus(
        table: string, 
        statusCol: string, 
        statusVals: Array<string>, 
        dateCol: string, 
        start: string, 
        end: string
      ): Promise<number> {
        let query = supabase.from(table).select("id", { count: "exact", head: true });
        query = query.in(statusCol, statusVals);
        query = query.gte(dateCol, start).lte(dateCol, end);
        const { count, error } = await query;
        return count || 0;
      };

      const totalSelected = await getCount("reports", "status", "pending", "created_at", targetStart, targetEnd);
      const totalPrev = await getCount("reports", "status", "pending", "created_at", compareStart, compareEnd);

      const activeSelected = await getCountMultipleStatus("announcements", "status", ["Reported", "Ongoing"], "created_at", targetStart, targetEnd);
      const activePrev = await getCountMultipleStatus("announcements", "status", ["Reported", "Ongoing"], "created_at", compareStart, compareEnd);

      const completedSelected = await getCount("announcements", "status", "Completed", "restored_at", targetStart, targetEnd);
      const completedPrev = await getCount("announcements", "status", "Completed", "restored_at", compareStart, compareEnd);

      /**
       * Updates a specific statistic tile in the DOM.
       */
      const updateTile = (valId: string, trendId: string, iconId: string, current: number, previous: number): void => {
        document.getElementById(valId).textContent = current;
        let percent = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);

        const isGood = valId === "value-completed" ? percent >= 0 : percent <= 0;
        const iconEl = document.getElementById(iconId);
        const trendEl = document.getElementById(trendId);

        iconEl.textContent = percent === 0 ? "horizontal_rule" : percent > 0 ? "arrow_upward" : "arrow_downward";
        const colorClass = percent === 0 ? "text-gray-500" : isGood ? "text-green-600" : "text-red-600";
        iconEl.className = `material-icons text-sm ${colorClass}`;

        const percentSpan = trendEl.querySelector("span:last-child");
        percentSpan.textContent = `${Math.abs(percent).toFixed(1)}%`;
        percentSpan.className = `text-xs font-bold ${colorClass}`;
      };

      updateTile("value-total", "trend-total", "icon-total", totalSelected, totalPrev);
      updateTile("value-active", "trend-active", "icon-active", activeSelected, activePrev);
      updateTile("value-completed", "trend-completed", "icon-completed", completedSelected, completedPrev);
    } catch (error) {
      console.error("Stats Error", error);
    }
  }

  // 3. CHARTS
  /**
   * Populates a checkbox list of feeders for filtering charts.
   * @async
   * @param {string} listId - The ID of the container element.
   */
  async function populateFeeders(listId: string) {
    const listContainer = document.getElementById(listId);
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="p-2 text-sm text-gray-500">Loading...</div>';

    const { data: feeders, error } = await supabase.from("feeders").select("id, name").order("name", { ascending: true });
    if (error) {
      listContainer.innerHTML = '<div class="p-2 text-sm text-red-500">Error loading feeders.</div>';
      return;
    }

    listContainer.innerHTML = feeders?.length ? "" : '<div class="p-2 text-sm">No feeders.</div>';
    feeders.forEach((feeder) => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded";
      label.innerHTML = `<input type="checkbox" value="${feeder.id}" checked class="form-checkbox text-blue-600 feeder-checkbox" />
        <span class="text-sm text-gray-700 dark:text-gray-200">${feeder.name}</span>`;
      listContainer.appendChild(label);
    });
  }

  /**
   * Updates the Pie Chart showing outage distribution across feeders.
   * @async
   */
  async function updateFeederChart() {
    if (!pieCanvas) return;
    const checked = Array.from(document.querySelectorAll("#feederList input:checked")).map((cb) => cb.value);
    if (checked.length === 0) {
      if (feederChartInstance) feederChartInstance.destroy();
      return;
    }

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data, error } = await supabase.from("announcements").select("feeder_id, feeders(name)")
      .in("feeder_id", checked).gte("created_at", sDate).lte("created_at", eDate);

    if (error || !data) return;

    /** @type {Object<string, number>} */
    const counts: { [key: string]: number } = {};
    data.forEach((item) => {
      const name: string = item.feeders ? item.feeders.name : `Feeder ${item.feeder_id}`;
      counts[name] = (counts[name] || 0) + 1;
    });

    if (feederChartInstance) feederChartInstance.destroy();
    feederChartInstance = new Chart(pieCanvas, {
      type: "pie",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#6366F1", "#EC4899"],
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });
  }

  type TimeData = {
    restored_at: string,
    created_at: string,
  };

  function getTimeDifference(item: TimeData): number {
    const restoredAt = new Date(item.restored_at).getTime();
    const createdAt = new Date(item.created_at).getTime();
    return (restoredAt - createdAt) / 36e5;
  }

  /**
   * Updates the Bar Chart showing average restoration time per feeder.
   * @async
   */
  async function updateRestorationChart() {
    if (!barCanvas) return;
    const checked = Array.from(document.querySelectorAll("#restorationFeederList input:checked")).map((cb) => cb.value);
    if (checked.length === 0) {
      if (restorationChartInstance) restorationChartInstance.destroy();
      return;
    }

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data, error } = await supabase.from("announcements").select("created_at, restored_at, feeder_id, feeders(name)")
      .eq("status", "Completed").in("feeder_id", checked).not("restored_at", "is", null).gte("created_at", sDate).lte("created_at", eDate);

    if (error || !data) return;

    const accData: { [key: string]: { total: number, count: number } } = {};
    data.forEach((item) => {
      const name: string = item.feeders ? item.feeders.name : `ID ${item.feeder_id}`;
      const hrs = getTimeDifference(item);
      if (hrs < 0 || !Number.isFinite(hrs)) return;
      if (!accData[name]) accData[name] = { total: 0, count: 0 };
      accData[name].total += hrs;
      accData[name].count += 1;
    });

    const labels = Object.keys(accData);
    const values = labels.map((k) => (accData[k].total / accData[k].count).toFixed(2));
    const isDark = document.documentElement.classList.contains("dark");

    if (restorationChartInstance) restorationChartInstance.destroy();
    restorationChartInstance = new Chart(barCanvas, {
      type: "bar",
      data: { labels, datasets: [{ label: "Avg Hours", data: values, backgroundColor: "#3B82F6" }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: isDark ? "#e5e7eb" : "#374151" }, grid: { color: isDark ? "#374151" : "#e5e7eb" } },
          x: { ticks: { color: isDark ? "#e5e7eb" : "#374151" }, grid: { display: false } },
        },
      },
    });
  }

  // 4. ADVANCED ANALYTICS
  /**
   * Loads complex datasets for Root Cause, Barangay Impact, Peak Times, and MTTR Trends.
   * @async
   */
  async function loadAdvancedAnalytics() {
    const rootCtx = document.getElementById("rootCauseChart");
    const brgyCtx = document.getElementById("barangayImpactChart");
    const peakCtx = document.getElementById("peakTimeChart");
    const mttrCtx = document.getElementById("mttrTrendChart");

    if (!rootCtx || !brgyCtx || !peakCtx || !mttrCtx) return;

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#e5e7eb" : "#374151";

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data: allAnnouncements, error } = await supabase.from("announcements")
      .select("cause, areas_affected, created_at, restored_at, status, feeder_id, feeders(name)")
      .gte("created_at", sDate).lte("created_at", eDate).order("created_at", { ascending: true });

    if (error || !allAnnouncements) return;

    // --- A. Root Cause logic ---
    const causeCounts: { [key: string]: number } = {};
    allAnnouncements.forEach((a) => {
      const c = a.cause || "Unknown";
      causeCounts[c] = (causeCounts[c] || 0) + 1;
    });
    const sortedCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (rootCauseInstance) rootCauseInstance.destroy();
    rootCauseInstance = new Chart(rootCtx, {
      type: "bar",
      data: {
        labels: sortedCauses.map((i) => i[0]),
        datasets: [{ label: "Incidents", data: sortedCauses.map((i) => i[1]), backgroundColor: "#F59E0B", borderRadius: 4 }],
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } },
    });

    // --- B. Barangay Impact logic ---
    const brgyCounts: { [key: string]: number } = {};
    allAnnouncements.forEach((a) => {
      if (Array.isArray(a.areas_affected)) a.areas_affected.forEach((b) => { brgyCounts[b] = (brgyCounts[b] || 0) + 1; });
    });
    const sortedBrgys = Object.entries(brgyCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    if (barangayImpactInstance) barangayImpactInstance.destroy();
    barangayImpactInstance = new Chart(brgyCtx, {
      type: "bar",
      data: {
        labels: sortedBrgys.map((i) => i[0]),
        datasets: [{ label: "Outage Events", data: sortedBrgys.map((i) => i[1]), backgroundColor: "#EF4444", borderRadius: 4 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } },
    });

    // --- C. Peak Time logic ---
    const timeMatrix: { [key: string]: number } = {};
    allAnnouncements.forEach((a) => {
      const date = new Date(a.created_at);
      const key = `${date.getDay()}-${date.getHours()}`;
      timeMatrix[key] = (timeMatrix[key] || 0) + 1;
    });

    const bubbleData = Object.entries(timeMatrix).map(([key, count]) => {
      const [day, hour] = key.split("-").map(Number);
      return { x: hour, y: day, r: Math.min(count * 2, 20) };
    });

    if (peakTimeInstance) peakTimeInstance.destroy();
    peakTimeInstance = new Chart(peakCtx, {
      type: "bubble",
      data: { datasets: [{ label: "Outage Frequency", data: bubbleData, backgroundColor: "rgba(59, 130, 246, 0.6)" }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 24, title: { display: true, text: "Hour of Day (24h)", color: textColor }, ticks: { color: textColor } },
          y: { min: -1, max: 7, ticks: { callback: (v) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][v] || "", color: textColor } },
        },
        plugins: { legend: { display: false } },
      },
    });

    // --- D. MTTR Trend logic ---
    const mttrByMonth: { [key: string]: { total: number, count: number } } = {};
    allAnnouncements.forEach((a) => {
      if (a.restored_at && a.created_at) {
        const date = new Date(a.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const hrs = getTimeDifference(a);
        if (hrs < 0 || !Number.isFinite(hrs)) return;
        if (!mttrByMonth[monthKey]) mttrByMonth[monthKey] = { total: 0, count: 0 };
        mttrByMonth[monthKey].total += hrs;
        mttrByMonth[monthKey].count += 1;
      }
    });

    const sortedMonths = Object.keys(mttrByMonth).sort();
    const mttrValues = sortedMonths.map((m) => (mttrByMonth[m].total / mttrByMonth[m].count).toFixed(2));

    if (mttrTrendInstance) mttrTrendInstance.destroy();
    mttrTrendInstance = new Chart(mttrCtx, {
      type: "line",
      data: {
        labels: sortedMonths,
        datasets: [{ label: "Avg Repair Time (Hrs)", data: mttrValues, borderColor: "#10B981", tension: 0.3, fill: true, backgroundColor: "rgba(16, 185, 129, 0.1)" }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } },
    });

    await buildForecasts(allAnnouncements);
  }

  // 4.1 Forecasting Helpers
  function computeFrequencyForecast(allAnnouncements: Array<{ restored_at: string, created_at: string, feeder_id?: string, feeders?: { name: string }, areas_affected?: Array<string> }>, horizonDays: number = 7) {
    if (!allAnnouncements?.length) return { feederProb: {}, barangayProb: {}, mttrSamples: [] };

    const feederCounts: { [key: string]: number } = {}, barangayCounts: { [key: string]: number } = {}, mttrSamples: number[] = [];
    allAnnouncements.forEach((a) => {
      if (a.feeder_id) {
        const feederName = a.feeders ? a.feeders.name : `Feeder ${a.feeder_id}`;
        feederCounts[feederName] = (feederCounts[feederName] || 0) + 1;
      }
      if (Array.isArray(a.areas_affected)) a.areas_affected.forEach((b) => { barangayCounts[b] = (barangayCounts[b] || 0) + 1; });
      if (a.restored_at && a.created_at) {
        const hrs = getTimeDifference({
          restored_at: a.restored_at,
          created_at: a.created_at,
        });
        if (hrs > 0 && Number.isFinite(hrs)) mttrSamples.push(hrs);
      }
    });

    const totalFeederEvents = Object.values(feederCounts).reduce((acc, v) => acc + v, 0);
    const totalBarangayEvents = Object.values(barangayCounts).reduce((acc, v) => acc + v, 0);

    const feederProb: { [key: string]: number } = {};
    Object.entries(feederCounts).forEach(([name, count]) => { feederProb[name] = count / (totalFeederEvents || 1); });
    const barangayProb: { [key: string]: number } = {};
    Object.entries(barangayCounts).forEach(([name, count]) => { barangayProb[name] = count / (totalBarangayEvents || 1); });

    return { feederProb, barangayProb, mttrSamples };
  }

  /**
   * Sorts MTTR samples into time buckets for restoration probability analysis.
   * @param {number[]} mttrSamples - Array of hours.
   * @returns {object} Counted buckets.
   */
  function computeRestorationBuckets(mttrSamples: $ReadOnlyArray<number>) {
    const buckets = { "<4h": 0, "4-8h": 0, "8-24h": 0, ">24h": 0 };
    mttrSamples.forEach((h) => {
      if (h < 4) buckets["<4h"] += 1;
      else if (h < 8) buckets["4-8h"] += 1;
      else if (h < 24) buckets["8-24h"] += 1;
      else buckets[">24h"] += 1;
    });
    return buckets;
}

  /**
   * Converts a numeric probability into a human-readable risk level.
   * @param {number} prob - Value between 0 and 1.
   * @returns {string} HIGH, MEDIUM, LOW, or NONE.
   */
  function getRiskLabel(prob: number): string {
    if (prob >= 0.35) return "HIGH";
    if (prob >= 0.2) return "MEDIUM";
    return prob > 0 ? "LOW" : "NONE";
  }

  /**
   * Generates forecasting charts and risk lists based on historical incident likelihood.
   * @async
   * @param {Array} allAnnouncements - Historical dataset.
   */
  async function buildForecasts(allAnnouncements: Array<{ restored_at: string, created_at: string, feeder_id?: string, feeders?: { name: string }, areas_affected?: Array<string> }>) {
    const forecastTime = new Date().toLocaleString();
    const { feederProb, barangayProb, mttrSamples } = computeFrequencyForecast(allAnnouncements);

    // --- Feeder Forecast logic ---
    const feederForecastCtx = document.getElementById("feederForecastChart");
    if (feederForecastCtx) {
      const topFeeders = Object.entries(feederProb)
      .sort((a, b) => {
        if (typeof a[1] === 'number' && typeof b[1] === 'number') {
          return b[1] - a[1];
        }
        return 0;
      })
      .slice(0, 6);
      const labels = topFeeders.map((i) => i[0]);
      const values = topFeeders.map((i) => {
        const prob = ((i[1]: any): number); 
        return (prob * 100).toFixed(1);
      });

      if (feederForecastInstance) feederForecastInstance.destroy();
      feederForecastInstance = new Chart(feederForecastCtx, {
        type: "bar",
        data: { labels, datasets: [{ label: "Probability (%)", data: values, backgroundColor: "#3B82F6", borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#6b7280", font: { size: 10 } }, grid: { display: false } }, y: { beginAtZero: true, max: 100, ticks: { color: "#6b7280", font: { size: 10 } } } } },
      });

      if (feederForecastSummary) {
        if (topFeeders.length > 0) {
          const highestRiskProb = ((topFeeders[0][1]: any): number);
          const feederName = String(topFeeders[0][0]);
          
          const percent = (highestRiskProb * 100).toFixed(1);
          
          feederForecastSummary.textContent = `Highest risk feeder: ${feederName} (~${percent}% of historical incidents).`;
        } else {
          feederForecastSummary.textContent = "Not enough historical data.";
        }
      }

      if (feederRiskList) {
        const topFeeders = Object.entries(feederProb)
          .sort((a, b) => {
            const valA = typeof a[1] === 'number' ? a[1] : 0;
            const valB = typeof b[1] === 'number' ? b[1] : 0;
            return valB - valA;
          })
          .slice(0, 6);

        feederRiskList.innerHTML = topFeeders.length ? "" : '<li class="text-gray-400">No data available.</li>';
      }
      if (forecastFeederUpdated) forecastFeederUpdated.textContent = `Updated: ${forecastTime}`;
    }

    // --- Restoration Forecast logic ---
    const restorationForecastCtx = document.getElementById("restorationForecastChart");
    if (restorationForecastCtx) {
      const buckets = computeRestorationBuckets(mttrSamples);
      const totalSamples = mttrSamples.length || 1;
      const labels = Object.keys(buckets);
      const values = labels.map((k) => ((buckets[k] / totalSamples) * 100).toFixed(1));

      if (restorationForecastInstance) restorationForecastInstance.destroy();
      restorationForecastInstance = new Chart(restorationForecastCtx, {
        type: "bar",
        data: { labels, datasets: [{ label: "Probability (%)", data: values, backgroundColor: "#10B981", borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { color: "#6b7280", font: { size: 10 } } }, x: { ticks: { color: "#6b7280", font: { size: 10 } }, grid: { display: false } } } },
      });
      if (forecastRestorationUpdated) forecastRestorationUpdated.textContent = `Updated: ${forecastTime}`;
    }

    if (overallRiskBadge instanceof HTMLElement) {
      const maxFeederProb: number = Object.values(feederProb).reduce(
        (acc: number, v: mixed): number => {
          const currentVal = typeof v === 'number' ? v : 0;
          return currentVal > acc ? currentVal : acc;
        }, 
        0
      );

      const riskLabel = getRiskLabel(maxFeederProb);
      
      overallRiskBadge.textContent = `Overall risk: ${riskLabel}`;
      
      const colorClass = riskLabel === "HIGH" ? "bg-red-100 text-red-700" : 
                        (riskLabel === "MEDIUM" ? "bg-amber-100 text-amber-700" : 
                        "bg-emerald-100 text-emerald-700");
                        
      overallRiskBadge.className = `inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${colorClass}`;
      
      const icon = document.createElement("span");
      if (icon instanceof HTMLElement) {
        icon.className = "material-icons text-xs";
        icon.textContent = "insights";
        overallRiskBadge.prepend(icon);
      }
    }
  }

  // 5. RECENT REPORTS
  /**
   * Populates the dashboard table with the most recent 6 outages.
   * @async
   */
  async function loadRecentReports() {
    if (!reportsTableBody) return;
    reportsTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>';

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data, error } = await supabase.from("announcements").select("*").gte("created_at", sDate).lte("created_at", eDate).order("created_at", { ascending: false }).limit(6);

    reportsTableBody.innerHTML = (error || !data?.length) ? '<tr><td colspan="6" class="text-center py-4 text-gray-500">No reports found.</td></tr>' : "";
    data?.forEach((item) => {
      const row = document.createElement("tr");
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700/50";
      const statusClass = getStatusClass(item.status);
      const dateStr = new Date(item.created_at).toLocaleDateString() + " " + new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      row.innerHTML = `<td class="py-3 px-4 dark:text-gray-200">${item.id}</td>
        <td class="py-3 px-4 dark:text-gray-300">${item.cause || item.location || "Outage"}</td>
        <td class="py-3 px-4 dark:text-gray-300">${item.feeder_id || "-"}</td>
        <td class="py-3 px-4 dark:text-gray-300">${dateStr}</td>
        <td class="py-3 px-4"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${item.status || "Unknown"}</span></td>
        <td class="py-3 px-4"><a href="outages.html?id=${item.id}" class="text-blue-600 hover:underline text-xs font-medium">View</a></td>`;
      reportsTableBody.appendChild(row);
    });
  }

  /**
   * Returns TailWind CSS classes for status badges.
   * @param {string} status - Outage status.
   * @returns {string} CSS classes.
   */
  function getStatusClass(status: ?string): string {
    if (!status) return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    const s = status.toLowerCase();
    if (s === "reported") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    if (s === "ongoing") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (s === "completed") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }

  /**
   * Generic setup for dropdown filters (Feeders, Restoration, etc.).
   */
  function setupFilter(btnId: string, popupId: string, selectAllId: string, clearId: string, applyId: string, listId: string, updateFn: () => ( void | Promise<void> )) {
    const btn = document.getElementById(btnId);
    const popup = document.getElementById(popupId);
    const selectAll = document.getElementById(selectAllId);
    const clear = document.getElementById(clearId);
    const apply = document.getElementById(applyId);
    const list = document.getElementById(listId);

    if (!btn || !popup) return;
    btn.addEventListener("click", (e) => { e.stopPropagation(); popup.classList.toggle("hidden"); });
    document.addEventListener("click", (e) => { if (!btn.contains(e.target) && !popup.contains(e.target)) popup.classList.add("hidden"); });

    if (selectAll && list) selectAll.addEventListener("click", (e) => { e.stopPropagation(); list.querySelectorAll("input").forEach((i) => (i.checked = true)); });
    if (clear && list) clear.addEventListener("click", (e) => { e.stopPropagation(); list.querySelectorAll("input").forEach((i) => (i.checked = false)); });
    if (apply) apply.addEventListener("click", () => { popup.classList.add("hidden"); updateFn(); });
  }

  /**
   * Initializes the dashboard by setting up filters and loading primary data.
   * @async
   */
  async function initDashboard() {
    setupFilter("feederFilterBtn", "feederFilterPopup", "feederSelectAll", "feederClear", "feederApply", "feederList", updateFeederChart);
    setupFilter("restorationFilterBtn", "restorationFilterPopup", "restorationSelectAll", "restorationClear", "restorationApply", "restorationFeederList", updateRestorationChart);

    refreshAllData();
    await Promise.all([populateFeeders("feederList"), populateFeeders("restorationFeederList")]);
    updateFeederChart(); updateRestorationChart();
  }

  // 6. PROFESSIONAL PDF REPORTING
  /** @type {jsPDF|null} The current active PDF document object */
  let currentPDFDoc = null;

  /**
   * Helper to load an image into a Promise.
   * @param {string} src - Image URL.
   * @returns {Promise<HTMLImageElement|null>}
   */
  const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve: (value: HTMLImageElement | null) => void) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  /**
   * Generates textual analysis for a chart based on its current data.
   * Used for the PDF report summaries.
   * @param {string} type - The chart category.
   * @param {Chart} chartInstance - The Chart.js instance.
   * @returns {string} Analysis recommendation.
   */
  function generateAnalysis(type: string, chartInstance: Chart): string {
    if (!chartInstance?.data?.datasets?.[0]?.data?.length) return "Insufficient data for detailed analysis.";
    const data = chartInstance.data.datasets[0].data;
    const labels = chartInstance.data.labels;

    if (type === "peak") {
      const dataset = chartInstance.data.datasets[0].data;
      const maxBubble = dataset.reduce((prev, current) => prev.r > current.r ? prev : current, { r: 0 });
      return maxBubble.r === 0 ? "No peak times detected." : `Highest frequency observed on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][maxBubble.y]}s around ${maxBubble.x}:00 hours.`;
    }

    const getMaxLabel = () => {
        const numData = data.map(d => Number(d) || 0);
        const maxVal = Math.max(...numData);
        if (maxVal === 0) return null;
        return { name: labels[numData.indexOf(maxVal)] || "Unknown", val: maxVal };
    };

    const top = getMaxLabel();
    if (type === "rootCause") return top?.name.includes("Vegetation") ? "Recommendation: Increase tree trimming schedule." : (top?.name.includes("Equipment") ? "Recommendation: Audit aging transformers." : `Investigate ${top?.name} frequency.`);
    if (type === "mttr") return (parseFloat(data[data.length-1]) < parseFloat(data[0])) ? "Repair times improving." : "Repair times trending up.";

    return "Data visualization available in chart.";
  }

  /**
   * Constructs the professional jsPDF document.
   * @async
   * @returns {Promise<jsPDF>}
   */
  async function generatePDFObject(): Promise<jsPDF> {
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;

    const logoImg = await loadImage("images/beneco.png");
    let adminEmail = "Authorized Account";
    try { const { data: { user } } = await supabase.auth.getUser(); if (user) adminEmail = user.email; } catch(e) {}

    if (logoImg) {
        doc.addImage(logoImg, "PNG", (pageWidth - 25) / 2, 10, 25, 25);
        yPos = 43; 
    }

    doc.setFontSize(24).setTextColor(0, 123, 255).setFont("helvetica", "bold").text("BEACON SYSTEM REPORT", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;
    doc.setFontSize(10).setTextColor(100).setFont("helvetica", "normal").text(`Generated by: ${adminEmail} | Range: ${rangeStartInput.value} to ${rangeEndInput.value}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Executive Summary Boxes
    doc.setFontSize(14).setTextColor(0).text("1. Executive Summary", margin, yPos);
    yPos += 10;
    const stats = [
        { label: "Total Reports", val: document.getElementById("value-total")?.textContent || "0" },
        { label: "Active Outages", val: document.getElementById("value-active")?.textContent || "0" },
        { label: "Completed", val: document.getElementById("value-completed")?.textContent || "0" }
    ];
    stats.forEach((s, i) => {
        doc.setFillColor(245, 247, 250).rect(margin + (i * 60), yPos, 55, 25, "F");
        doc.setFontSize(10).setFont("helvetica", "bold").text(s.label, margin + (i * 60) + 5, yPos + 8);
        doc.setFontSize(16).setFont("helvetica", "normal").text(s.val, margin + (i * 60) + 5, yPos + 18);
    });
    yPos += 35;

    // Add Charts to PDF
    const allCharts = [
      { title: "2. Outages by Feeder", instance: feederChartInstance, type: "feederCount" },
      { title: "3. Avg Restoration Time", instance: restorationChartInstance, type: "feederTime" },
      { title: "4. Root Cause Analysis", instance: rootCauseInstance, type: "rootCause" },
      { title: "5. Peak Outage Times", instance: peakTimeInstance, type: "peak" },
      { title: "6. Feeder Risk Forecast", instance: feederForecastInstance, type: "feederForecast" }
    ];

    allCharts.forEach((item) => {
      if (!item.instance) return;
      if (yPos + 100 > pageHeight) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12).setFont("helvetica", "bold").text(item.title, margin, yPos);
      yPos += 5;
      doc.addImage(item.instance.toBase64Image(), "PNG", margin, yPos, 180, 80);
      yPos += 85;
      doc.setFillColor(240, 248, 255).rect(margin, yPos, pageWidth - (margin*2), 15, "F");
      doc.setFontSize(9).setFont("helvetica", "normal").text(generateAnalysis(item.type, item.instance), margin + 5, yPos + 8);
      yPos += 20;
    });

    return doc;
  }

  /**
   * Opens the PDF preview modal and generates the document blob.
   */
  async function handlePreviewOpen() {
    const modal = document.getElementById("pdfPreviewModal");
    const iframe = document.getElementById("pdfPreviewFrame");
    const loading = document.getElementById("pdfLoading");
    if (!modal || !iframe) return;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    iframe.classList.add("hidden");
    loading.classList.remove("hidden");

    currentPDFDoc = await generatePDFObject();
    iframe.src = currentPDFDoc.output("bloburl");
    loading.classList.add("hidden");
    iframe.classList.remove("hidden");
  }

  function handlePreviewClose() {
    const modal = document.getElementById("pdfPreviewModal");
    if (modal) modal.classList.add("hidden");
  }

  function handleDownload() {
    if (!currentPDFDoc) return;
    currentPDFDoc.save(`BeaconReport_${new Date().toISOString().split("T")[0]}.pdf`);
    handlePreviewClose();
  }

  document.getElementById("downloadReportBtn")?.addEventListener("click", handlePreviewOpen);
  document.getElementById("closePreviewBtn")?.addEventListener("click", handlePreviewClose);
  document.getElementById("confirmDownloadBtn")?.addEventListener("click", handleDownload);

  initDashboard();
});