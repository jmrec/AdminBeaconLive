// DASHBOARD.JS - Final Fixes: Root Cause Sentiment Analysis & Robust Reporting

document.addEventListener("DOMContentLoaded", () => {
  // --- Global State ---
  // Default: Past 30 days
  let currentEndDate = new Date();
  let currentStartDate = new Date();
  currentStartDate.setDate(currentEndDate.getDate() - 30);

  // --- Global Chart Instances ---
  let feederChartInstance = null;
  let restorationChartInstance = null;
  let rootCauseInstance = null;
  let barangayImpactInstance = null;
  let peakTimeInstance = null;
  // REMOVED: let mttrTrendInstance = null; // Replaced by Sentiment HTML

  // NEW: Store sentiment data for PDF generation since it is not a canvas chart
  let sentimentDataForPDF = [];

  // Forecast chart instances
  let feederForecastInstance = null;
  let barangayForecastInstance = null;
  let restorationForecastInstance = null;

  // --- DOM Elements ---
  const pieCanvas = document.getElementById("feederChartCanvas");
  const barCanvas = document.getElementById("restorationChartCanvas");
  const reportsTableBody = document.getElementById("reportsBody");

  // Forecast DOM
  const feederForecastSummary = document.getElementById("feederForecastSummary");
  const barangayForecastSummary = document.getElementById("barangayForecastSummary");
  const restorationForecastSummary = document.getElementById("restorationForecastSummary");
  const feederRiskList = document.getElementById("feederRiskList");
  const barangayRiskList = document.getElementById("barangayRiskList");
  const overallRiskBadge = document.getElementById("overallRiskBadge");
  const forecastFeederUpdated = document.getElementById("forecastFeederUpdated");
  const forecastBarangayUpdated = document.getElementById("forecastBarangayUpdated");
  const forecastRestorationUpdated = document.getElementById("forecastRestorationUpdated");

  // Date Filter Elements (New Range Logic)
  const dateRangeBtn = document.getElementById("dateRangeBtn");
  const dateRangeDropdown = document.getElementById("dateRangeDropdown");
  const rangeStartInput = document.getElementById("rangeStart");
  const rangeEndInput = document.getElementById("rangeEnd");
  const applyDateRangeBtn = document.getElementById("applyDateRangeBtn");
  const dateRangeLabel = document.getElementById("dateRangeLabel");

  // Initialize Inputs
  if (rangeStartInput && rangeEndInput) {
    rangeStartInput.value = currentStartDate.toISOString().split("T")[0];
    rangeEndInput.value = currentEndDate.toISOString().split("T")[0];
    updateDateLabel();
  }

  function updateDateLabel() {
    if (dateRangeLabel) {
      dateRangeLabel.textContent = `${rangeStartInput.value} - ${rangeEndInput.value}`;
    }
  }

  // 1. MAP HEATMAP LOGIC
  const map = L.map("map").setView([16.4023, 120.5960], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  let heatLayer = null;
  // Default to "pending" to show unaddressed reports immediately
  let heatFilter = "pending"; 
  let heatmapUseDateRange = false;

  const heatFilterLabel = document.querySelector("#heatmapFilterBtn span:nth-child(4)");
  if (heatFilterLabel) heatFilterLabel.textContent = "Pending only";

  async function fetchHeatmapData() {
    let heatPoints = [];
    // Increase weight/intensity for visibility
    const STATUS_WEIGHT = { pending: 1.5, reported: 2, ongoing: 3 };

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    try {
      // 1. Fetch PENDING reports (The unaddressed ones from 'reports' table)
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
            .map((r) => [
              Number(r.latitude), 
              Number(r.longitude), 
              STATUS_WEIGHT.pending
            ]);
          heatPoints = heatPoints.concat(points);
        }
      }

      // 2. Fetch REPORTED/ONGOING (From 'announcements' table)
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

      // Update Map Layer
      if (heatLayer) heatLayer.remove();
      if (heatPoints.length > 0) {
        heatLayer = L.heatLayer(heatPoints, { 
            radius: 25, 
            blur: 15,
            maxZoom: 15
        }).addTo(map);
      }
    } catch (err) {
      console.error("Error updating heatmap", err);
    }
  }

  // Trigger immediately
  fetchHeatmapData();
  // Refresh periodically
  setInterval(fetchHeatmapData, 30000);

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
        fetchHeatmapData(); // Refresh immediately on change
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
  if (dateRangeBtn && dateRangeDropdown) {
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

  if (applyDateRangeBtn) {
    applyDateRangeBtn.addEventListener("click", () => {
      const sVal = rangeStartInput.value;
      const eVal = rangeEndInput.value;
      
      if (sVal && eVal) {
        currentStartDate = new Date(sVal);
        currentEndDate = new Date(eVal);
        updateDateLabel();
        dateRangeDropdown.classList.add("hidden");
        
        // Refresh all data with new range
        refreshAllData();
      }
    });
  }

  async function refreshAllData() {
    await Promise.all([
      loadDashboardStats(),
      updateFeederChart(),
      updateRestorationChart(),
      loadAdvancedAnalytics(),
      loadRecentReports()
    ]);
  }

  // Format Helper
  const toISODate = (d) => d.toISOString().split("T")[0];

  async function loadDashboardStats() {
    if (!window.supabase) return;

    try {
      const sDateStr = toISODate(currentStartDate);
      const eDateStr = toISODate(currentEndDate);

      // Current Period
      const targetStart = `${sDateStr}T00:00:00Z`;
      const targetEnd = `${eDateStr}T23:59:59Z`;

      // Comparison Period (Same duration immediately before)
      const diffTime = Math.abs(currentEndDate - currentStartDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
      
      const prevEndObj = new Date(currentStartDate);
      prevEndObj.setDate(prevEndObj.getDate() - 1);
      const prevStartObj = new Date(prevEndObj);
      prevStartObj.setDate(prevStartObj.getDate() - diffDays + 1);

      const compareStart = `${toISODate(prevStartObj)}T00:00:00Z`;
      const compareEnd = `${toISODate(prevEndObj)}T23:59:59Z`;

      const getCount = async (table, statusCol, statusVal, dateCol, start, end) => {
        let query = supabase.from(table).select("id", { count: "exact", head: true });
        if (statusCol && statusVal) query = query.eq(statusCol, statusVal);
        query = query.gte(dateCol, start).lte(dateCol, end);
        const { count, error } = await query;
        if (error) console.error(`Error fetching count from ${table}:`, error);
        return count || 0;
      };

      const getCountMultipleStatus = async (table, statusCol, statusVals, dateCol, start, end) => {
        let query = supabase.from(table).select("id", { count: "exact", head: true });
        query = query.in(statusCol, statusVals);
        query = query.gte(dateCol, start).lte(dateCol, end);
        const { count, error } = await query;
        if (error) console.error(`Error fetching multi-status count from ${table}:`, error);
        return count || 0;
      };

      // Total reports = count of pending reports from reports table only
      const totalSelected = await getCount("reports", "status", "pending", "created_at", targetStart, targetEnd);
      const totalPrev = await getCount("reports", "status", "pending", "created_at", compareStart, compareEnd);

      // Active outages = count of announcements with status Reported or Ongoing
      const activeSelected = await getCountMultipleStatus(
        "announcements",
        "status",
        ["Reported", "Ongoing"],
        "created_at",
        targetStart,
        targetEnd
      );
      const activePrev = await getCountMultipleStatus(
        "announcements",
        "status",
        ["Reported", "Ongoing"],
        "created_at",
        compareStart,
        compareEnd
      );

      // Completed repairs
      const completedSelected = await getCount(
        "announcements",
        "status",
        "Completed",
        "restored_at",
        targetStart,
        targetEnd
      );
      const completedPrev = await getCount(
        "announcements",
        "status",
        "Completed",
        "restored_at",
        compareStart,
        compareEnd
      );

      const updateTile = (valId, trendId, iconId, current, previous) => {
        document.getElementById(valId).textContent = current;
        let percent = 0;
        if (previous > 0) {
          percent = ((current - previous) / previous) * 100;
        } else if (current > 0) {
          percent = 100;
        } else {
          percent = 0;
        }

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
  async function populateFeeders(listId) {
    const listContainer = document.getElementById(listId);
    if (!listContainer) return;

    listContainer.innerHTML =
      '<div class="p-2 text-sm text-gray-500">Loading...</div>';

    const { data: feeders, error } = await supabase
      .from("feeders")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      listContainer.innerHTML =
        '<div class="p-2 text-sm text-red-500">Error loading feeders.</div>';
      return;
    }

    listContainer.innerHTML = "";
    if (!feeders || feeders.length === 0) {
      listContainer.innerHTML =
        '<div class="p-2 text-sm">No feeders.</div>';
      return;
    }

    feeders.forEach((feeder) => {
      const label = document.createElement("label");
      label.className =
        "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded";
      label.innerHTML = `
        <input type="checkbox" value="${feeder.id}" checked
               class="form-checkbox text-blue-600 feeder-checkbox" />
        <span class="text-sm text-gray-700 dark:text-gray-200">${feeder.name}</span>
      `;
      listContainer.appendChild(label);
    });
  }

  async function updateFeederChart() {
    if (!pieCanvas) return;

    const checked = Array.from(
      document.querySelectorAll("#feederList input:checked")
    ).map((cb) => cb.value);

    if (checked.length === 0) {
      if (feederChartInstance) feederChartInstance.destroy();
      return;
    }

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data, error } = await supabase
      .from("announcements")
      .select("feeder_id, feeders(name)")
      .in("feeder_id", checked)
      .gte("created_at", sDate)
      .lte("created_at", eDate);

    if (error || !data) return;

    const counts = {};
    data.forEach((item) => {
      const name = item.feeders ? item.feeders.name : `Feeder ${item.feeder_id}`;
      counts[name] = (counts[name] || 0) + 1;
    });

    if (feederChartInstance) feederChartInstance.destroy();

    feederChartInstance = new Chart(pieCanvas, {
      type: "pie",
      data: {
        labels: Object.keys(counts),
        datasets: [
          {
            data: Object.values(counts),
            backgroundColor: [
              "#3B82F6",
              "#EF4444",
              "#10B981",
              "#F59E0B",
              "#6366F1",
              "#EC4899",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });
  }

  async function updateRestorationChart() {
    if (!barCanvas) return;

    const checked = Array.from(
      document.querySelectorAll("#restorationFeederList input:checked")
    ).map((cb) => cb.value);

    if (checked.length === 0) {
      if (restorationChartInstance) restorationChartInstance.destroy();
      return;
    }

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data, error } = await supabase
      .from("announcements")
      .select("created_at, restored_at, feeder_id, feeders(name)")
      .eq("status", "Completed")
      .in("feeder_id", checked)
      .not("restored_at", "is", null)
      .gte("created_at", sDate)
      .lte("created_at", eDate);

    if (error || !data) return;

    const accData = {};
    data.forEach((item) => {
      const name = item.feeders ? item.feeders.name : `ID ${item.feeder_id}`;
      const hrs =
        (new Date(item.restored_at) - new Date(item.created_at)) / 36e5;
      if (hrs < 0 || !Number.isFinite(hrs)) return;
      if (!accData[name]) accData[name] = { total: 0, count: 0 };
      accData[name].total += hrs;
      accData[name].count += 1;
    });

    const labels = Object.keys(accData);
    const values = labels.map((k) =>
      (accData[k].total / accData[k].count).toFixed(2)
    );
    const isDark = document.documentElement.classList.contains("dark");

    if (restorationChartInstance) restorationChartInstance.destroy();

    restorationChartInstance = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Avg Hours",
            data: values,
            backgroundColor: "#3B82F6",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: isDark ? "#e5e7eb" : "#374151" },
            grid: { color: isDark ? "#374151" : "#e5e7eb" },
          },
          x: {
            ticks: { color: isDark ? "#e5e7eb" : "#374151" },
            grid: { display: false },
          },
        },
      },
    });
  }

  // 4. ADVANCED ANALYTICS (Fixed: Sentiment Analysis Replaces MTTR)
  async function loadAdvancedAnalytics() {
    // 1. Get Contexts for the Standard Charts
    const rootCtx = document.getElementById("rootCauseChart");
    const brgyCtx = document.getElementById("barangayImpactChart");
    const peakCtx = document.getElementById("peakTimeChart");

    // 2. Safety Check: Only stop if the *remaining* standard charts are missing
    if (!rootCtx || !brgyCtx || !peakCtx) return;

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#e5e7eb" : "#374151";

    // 3. Fetch Data for Charts A, B, C (Announcements)
    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data: allAnnouncements, error } = await supabase
        .from("announcements")
        .select("cause, areas_affected, created_at, feeders(name), restored_at")
        .gte("created_at", sDate)
        .lte("created_at", eDate)
        .order("created_at", { ascending: true });

    if (error || !allAnnouncements) return;

    // --- A. Root Cause Frequency (Bar Chart) ---
    const causeCounts = {};
    allAnnouncements.forEach((a) => {
        const c = a.cause || "Unknown";
        causeCounts[c] = (causeCounts[c] || 0) + 1;
    });
    const sortedCauses = Object.entries(causeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (rootCauseInstance) rootCauseInstance.destroy();
    rootCauseInstance = new Chart(rootCtx, {
        type: "bar",
        data: {
            labels: sortedCauses.map((i) => i[0]),
            datasets: [{
                label: "Incidents",
                data: sortedCauses.map((i) => i[1]),
                backgroundColor: "#F59E0B",
                borderRadius: 4,
            }],
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textColor } },
                y: { ticks: { color: textColor } },
            },
        },
    });

    // --- B. Barangay Impact (Bar Chart) ---
    const brgyCounts = {};
    allAnnouncements.forEach((a) => {
        if (Array.isArray(a.areas_affected)) {
            a.areas_affected.forEach((b) => {
                brgyCounts[b] = (brgyCounts[b] || 0) + 1;
            });
        }
    });

    const sortedBrgys = Object.entries(brgyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    if (barangayImpactInstance) barangayImpactInstance.destroy();
    barangayImpactInstance = new Chart(brgyCtx, {
        type: "bar",
        data: {
            labels: sortedBrgys.map((i) => i[0]),
            datasets: [{
                label: "Outage Events",
                data: sortedBrgys.map((i) => i[1]),
                backgroundColor: "#EF4444",
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textColor } },
                y: { ticks: { color: textColor } },
            },
        },
    });

    // --- C. Peak Time (Bubble Chart) ---
    const timeMatrix = {};
    allAnnouncements.forEach((a) => {
        const date = new Date(a.created_at);
        const key = `${date.getDay()}-${date.getHours()}`;
        timeMatrix[key] = (timeMatrix[key] || 0) + 1;
    });

    const bubbleData = Object.entries(timeMatrix).map(([key, count]) => {
        const [day, hour] = key.split("-").map(Number);
        return {
            x: hour,
            y: day,
            r: Math.min(count * 2, 20),
        };
    });

    if (peakTimeInstance) peakTimeInstance.destroy();
    peakTimeInstance = new Chart(peakCtx, {
        type: "bubble",
        data: {
            datasets: [{
                label: "Outage Frequency",
                data: bubbleData,
                backgroundColor: "rgba(59, 130, 246, 0.6)",
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    min: 0, max: 24,
                    title: { display: true, text: "Hour of Day (24h)", color: textColor },
                    ticks: { color: textColor },
                },
                y: {
                    min: -1, max: 7,
                    ticks: {
                        callback: (v) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][v] || "",
                        color: textColor,
                    },
                },
            },
            plugins: { legend: { display: false } },
        },
    });

    // --- D. NEW: Root Cause Sentiment (The replacement for MTTR) ---
    // This targets the new <div> added to the HTML
    const sentimentContainer = document.getElementById("root-cause-chart-container");
    
    if (sentimentContainer) {
        try {
            // Fetch User Reports (Reports contain sentiment, Announcements do not)
            const { data: reportData, error: reportError } = await supabase
                .from('reports')
                .select('cause, sentiment_score')
                .not('sentiment_score', 'is', null) // Only get scored reports
                .limit(100);

            if (reportError) throw reportError;

            if (!reportData || reportData.length === 0) {
                sentimentContainer.innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#888;font-size:0.8rem;">No sentiment data available</div>`;
            } else {
                // 1. Group & Calculate Average
                const groups = {}; 
                reportData.forEach(r => {
                    const cause = r.cause || 'Other';
                    if (!groups[cause]) groups[cause] = { total: 0, count: 0 };
                    groups[cause].total += r.sentiment_score;
                    groups[cause].count += 1;
                });

                // 2. Sort by Negativity (Lowest score first)
                const sortedSentiment = Object.keys(groups).map(cause => {
                    const avg = groups[cause].total / groups[cause].count;
                    return { cause, score: avg };
                }).sort((a, b) => a.score - b.score);

                // STORE FOR PDF GENERATION
                sentimentDataForPDF = sortedSentiment;

                // 3. Render HTML Bars
                let html = `<div style="display:flex; flex-direction:column; gap:12px; padding-bottom:10px;">`;
                
                sortedSentiment.forEach(item => {
                    const severity = Math.abs(Math.min(item.score, 0)); 
                    const width = Math.min((severity / 10) * 100, 100); 
                    
                    let color = '#2ecc71'; // Green (Neutral)
                    if (item.score <= -5) color = '#e74c3c'; // Red (Critical)
                    else if (item.score < 0) color = '#f1c40f'; // Yellow (Negative)

                    html += `
                        <div style="width:100%;">
                            <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px; color:${textColor}; font-weight:600;">
                                <span>${item.cause}</span>
                                <span style="color:${color}">${item.score.toFixed(1)}</span>
                            </div>
                            <div style="width:100%; background:#e5e7eb; height:6px; border-radius:3px; overflow:hidden;">
                                <div style="width:${width}%; background:${color}; height:100%;"></div>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
                sentimentContainer.innerHTML = html;
            }
        } catch (err) {
            console.warn("Sentiment loading failed:", err);
            sentimentContainer.innerHTML = `<div style="color:#aaa; font-size:0.8rem; text-align:center; padding-top:20px;">Analysis unavailable</div>`;
        }
    }

    await buildForecasts(allAnnouncements);
  }

  // 4.1 Forecasting Helpers
  function computeFrequencyForecast(allAnnouncements, horizonDays = 7) {
    if (!allAnnouncements || allAnnouncements.length === 0) {
      return {
        feederProb: {},
        barangayProb: {},
        mttrSamples: [],
      };
    }

    const feederCounts = {};
    const barangayCounts = {};
    const mttrSamples = [];

    allAnnouncements.forEach((a) => {
      if (a.feeder_id) {
        const feederName = a.feeders ? a.feeders.name : `Feeder ${a.feeder_id}`;
        feederCounts[feederName] = (feederCounts[feederName] || 0) + 1;
      }
      if (Array.isArray(a.areas_affected)) {
        a.areas_affected.forEach((b) => {
          barangayCounts[b] = (barangayCounts[b] || 0) + 1;
        });
      }
      if (a.restored_at && a.created_at) {
        const hrs =
          (new Date(a.restored_at) - new Date(a.created_at)) / 36e5;
        if (hrs > 0 && Number.isFinite(hrs)) {
          mttrSamples.push(hrs);
        }
      }
    });

    const totalFeederEvents = Object.values(feederCounts).reduce(
      (acc, v) => acc + v,
      0
    );
    const totalBarangayEvents = Object.values(barangayCounts).reduce(
      (acc, v) => acc + v,
      0
    );

    const feederProb = {};
    Object.entries(feederCounts).forEach(([name, count]) => {
      feederProb[name] = count / (totalFeederEvents || 1);
    });

    const barangayProb = {};
    Object.entries(barangayCounts).forEach(([name, count]) => {
      barangayProb[name] = count / (totalBarangayEvents || 1);
    });

    return {
      feederProb,
      barangayProb,
      mttrSamples,
    };
  }

  function computeRestorationBuckets(mttrSamples) {
    const buckets = { "<4h": 0, "4-8h": 0, "8-24h": 0, ">24h": 0 };
    if (!mttrSamples || mttrSamples.length === 0) return buckets;

    mttrSamples.forEach((h) => {
      if (h < 4) buckets["<4h"] += 1;
      else if (h < 8) buckets["4-8h"] += 1;
      else if (h < 24) buckets["8-24h"] += 1;
      else buckets[">24h"] += 1;
    });

    return buckets;
  }

  function getRiskLabel(prob) {
    if (prob >= 0.35) return "HIGH";
    if (prob >= 0.2) return "MEDIUM";
    if (prob > 0) return "LOW";
    return "NONE";
  }

  async function buildForecasts(allAnnouncements) {
    const forecastHorizonDays = 7;
    const forecastTime = new Date().toLocaleString();

    const {
      feederProb,
      barangayProb,
      mttrSamples,
    } = computeFrequencyForecast(allAnnouncements, forecastHorizonDays);

    // --- Feeder Forecast ---
    const feederForecastCtx = document.getElementById("feederForecastChart");
    if (feederForecastCtx) {
      const topFeeders = Object.entries(feederProb)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const labels = topFeeders.map((i) => i[0]);
      const values = topFeeders.map((i) => (i[1] * 100).toFixed(1));

      if (feederForecastInstance) feederForecastInstance.destroy();
      feederForecastInstance = new Chart(feederForecastCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Probability (%)",
              data: values,
              backgroundColor: "#3B82F6",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: { color: "#6b7280", font: { size: 10 } },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { color: "#6b7280", font: { size: 10 } },
            },
          },
        },
      });

      if (feederForecastSummary) {
        if (topFeeders.length === 0) {
          feederForecastSummary.textContent =
            "Not enough historical data to estimate feeder risk.";
        } else {
          const [topName, topProb] = topFeeders[0];
          feederForecastSummary.textContent = `Highest risk feeder: ${topName} (~${(
            topProb * 100
          ).toFixed(
            1
          )}% of historical incidents).`;
        }
      }

      if (feederRiskList) {
        feederRiskList.innerHTML = "";
        if (topFeeders.length === 0) {
          feederRiskList.innerHTML =
            '<li class="text-gray-400">No data available.</li>';
        } else {
          topFeeders.forEach(([name, p]) => {
            const li = document.createElement("li");
            li.innerHTML = `
              <span class="font-semibold">${name}</span>
              – ${(p * 100).toFixed(1)}% share
              <span class="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                getRiskLabel(p) === "HIGH"
                  ? "bg-red-100 text-red-700"
                  : getRiskLabel(p) === "MEDIUM"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }">
                ${getRiskLabel(p)}
              </span>
            `;
            feederRiskList.appendChild(li);
          });
        }
      }
      if (forecastFeederUpdated) forecastFeederUpdated.textContent = `Updated: ${forecastTime}`;
    }

    // --- Barangay Forecast ---
    const barangayForecastCtx = document.getElementById("barangayForecastChart");
    if (barangayForecastCtx) {
      const topBrgys = Object.entries(barangayProb)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const labels = topBrgys.map((i) => i[0]);
      const values = topBrgys.map((i) => (i[1] * 100).toFixed(1));

      if (barangayForecastInstance) barangayForecastInstance.destroy();
      barangayForecastInstance = new Chart(barangayForecastCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Probability (%)",
              data: values,
              backgroundColor: "#EF4444",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              ticks: { color: "#6b7280", font: { size: 10 } },
            },
            y: {
              ticks: { color: "#6b7280", font: { size: 10 } },
            },
          },
        },
      });

      if (barangayForecastSummary) {
        if (topBrgys.length === 0) {
          barangayForecastSummary.textContent =
            "Not enough historical data to estimate barangay risk.";
        } else {
          const [topName, topProb] = topBrgys[0];
          barangayForecastSummary.textContent = `Barangay with highest expected risk: ${topName} (~${(
            topProb * 100
          ).toFixed(
            1
          )}% of historical incidents).`;
        }
      }

      if (barangayRiskList) {
        barangayRiskList.innerHTML = "";
        if (topBrgys.length === 0) {
          barangayRiskList.innerHTML =
            '<li class="text-gray-400">No data available.</li>';
        } else {
          topBrgys.forEach(([name, p]) => {
            const li = document.createElement("li");
            li.innerHTML = `
              <span class="font-semibold">${name}</span>
              – ${(p * 100).toFixed(1)}% share
              <span class="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                getRiskLabel(p) === "HIGH"
                  ? "bg-red-100 text-red-700"
                  : getRiskLabel(p) === "MEDIUM"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }">
                ${getRiskLabel(p)}
              </span>
            `;
            barangayRiskList.appendChild(li);
          });
        }
      }
      if (forecastBarangayUpdated) forecastBarangayUpdated.textContent = `Updated: ${forecastTime}`;
    }

    // --- Restoration Forecast ---
    const restorationForecastCtx = document.getElementById(
      "restorationForecastChart"
    );
    if (restorationForecastCtx) {
      const buckets = computeRestorationBuckets(mttrSamples);
      const totalSamples = mttrSamples.length || 1;

      const labels = Object.keys(buckets);
      const values = labels.map((k) =>
        ((buckets[k] / totalSamples) * 100).toFixed(1)
      );

      if (restorationForecastInstance)
        restorationForecastInstance.destroy();
      restorationForecastInstance = new Chart(restorationForecastCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Probability (%)",
              data: values,
              backgroundColor: "#10B981",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { color: "#6b7280", font: { size: 10 } },
            },
            x: {
              ticks: { color: "#6b7280", font: { size: 10 } },
              grid: { display: false },
            },
          },
        },
      });

      if (restorationForecastSummary) {
        if (!mttrSamples.length) {
          restorationForecastSummary.textContent =
            "Not enough completed outage history to estimate restoration probabilities.";
        } else {
          const fast =
            ((buckets["<4h"] + buckets["4-8h"]) / totalSamples) * 100;
          restorationForecastSummary.textContent = `Historically, ${fast.toFixed(
            1
          )}% of outages are restored in less than 8 hours.`;
        }
      }
      if (forecastRestorationUpdated) forecastRestorationUpdated.textContent = `Updated: ${forecastTime}`;
    }

    if (overallRiskBadge) {
      const maxFeederProb =
        Object.values(feederProb).reduce(
          (acc, v) => (v > acc ? v : acc),
          0
        ) || 0;
      const riskLabel = getRiskLabel(maxFeederProb);
      overallRiskBadge.textContent = `Overall risk: ${riskLabel}`;
      overallRiskBadge.className =
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold " +
        (riskLabel === "HIGH"
          ? "bg-red-100 text-red-700"
          : riskLabel === "MEDIUM"
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700");
      const icon = document.createElement("span");
      icon.className = "material-icons text-xs";
      icon.textContent = "insights";
      overallRiskBadge.prepend(icon);
    }
  }

  // 5. RECENT REPORTS
  async function loadRecentReports() {
    if (!reportsTableBody) return;

    reportsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">Loading...</td>
      </tr>
    `;

    const sDate = `${toISODate(currentStartDate)}T00:00:00Z`;
    const eDate = `${toISODate(currentEndDate)}T23:59:59Z`;

    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .gte("created_at", sDate)
      .lte("created_at", eDate)
      .order("created_at", { ascending: false })
      .limit(6);

    reportsTableBody.innerHTML = "";
    if (error || !data || data.length === 0) {
      reportsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-gray-500">No reports found in this date range.</td>
        </tr>
      `;
      return;
    }

    data.forEach((item) => {
      const row = document.createElement("tr");
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700/50";
      const title = item.cause || item.location || "Outage";
      const statusClass = getStatusClass(item.status);
      const dateStr = new Date(item.created_at).toLocaleDateString() +
        " " +
        new Date(item.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

      row.innerHTML = `
        <td class="py-3 px-4 dark:text-gray-200">${item.id}</td>
        <td class="py-3 px-4 dark:text-gray-300">${title}</td>
        <td class="py-3 px-4 dark:text-gray-300">${item.feeder_id || "-"}</td>
        <td class="py-3 px-4 dark:text-gray-300">${dateStr}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
            ${item.status || "Unknown"}
          </span>
        </td>
        <td class="py-3 px-4">
          <a href="outages.html?id=${item.id}" class="text-blue-600 hover:underline text-xs font-medium">
            View
          </a>
        </td>
      `;
      reportsTableBody.appendChild(row);
    });
  }

  function getStatusClass(status) {
    if (!status) return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    const s = status.toLowerCase();
    if (s === "reported")
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    if (s === "ongoing")
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (s === "completed")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }

  function setupFilter(btnId, popupId, selectAllId, clearId, applyId, listId, updateFn) {
    const btn = document.getElementById(btnId);
    const popup = document.getElementById(popupId);
    const selectAll = document.getElementById(selectAllId);
    const clear = document.getElementById(clearId);
    const apply = document.getElementById(applyId);
    const list = document.getElementById(listId);

    if (!btn || !popup) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      popup.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!btn.contains(e.target) && !popup.contains(e.target)) {
        popup.classList.add("hidden");
      }
    });

    if (selectAll && list) {
      selectAll.addEventListener("click", (e) => {
        e.stopPropagation();
        list.querySelectorAll("input").forEach((i) => (i.checked = true));
      });
    }

    if (clear && list) {
      clear.addEventListener("click", (e) => {
        e.stopPropagation();
        list.querySelectorAll("input").forEach((i) => (i.checked = false));
      });
    }

    if (apply) {
      apply.addEventListener("click", () => {
        popup.classList.add("hidden");
        updateFn();
      });
    }
  }

  async function initDashboard() {
    setupFilter(
      "feederFilterBtn",
      "feederFilterPopup",
      "feederSelectAll",
      "feederClear",
      "feederApply",
      "feederList",
      updateFeederChart
    );

    setupFilter(
      "restorationFilterBtn",
      "restorationFilterPopup",
      "restorationSelectAll",
      "restorationClear",
      "restorationApply",
      "restorationFeederList",
      updateRestorationChart
    );

    // Initial Data Load
    refreshAllData();

    await Promise.all([
      populateFeeders("feederList"),
      populateFeeders("restorationFeederList"),
    ]);

    updateFeederChart();
    updateRestorationChart();
  }

  // 6. PROFESSIONAL PDF REPORTING WITH CENTERED LOGO & SAFE RECOMMENDATIONS
  let currentPDFDoc = null;

  // Helper to load image
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => {
          console.warn("Could not load logo:", src);
          resolve(null);
      };
      img.src = src;
    });
  };

  function generateAnalysis(type, chartInstance) {
    // 1. Safety Check: If chart doesn't exist or data is empty, return generic message.
    if (!chartInstance) {
        return "Insufficient data for detailed analysis.";
    }

    // Special Case: Sentiment (Uses raw data array)
    if (type === "sentiment") {
      const data = chartInstance; // In this case, instance is the data array
      if (!data || data.length === 0) return "No sentiment data available.";
      
      const worst = data[0]; // Sorted ascending (negatives first), so index 0 is most negative
      
      let analysis = `Analysis: Public sentiment varies across categories. `;
      
      if (worst.score < -2) {
        analysis += `CRITICAL: "${worst.cause}" is generating significant negative feedback (Score: ${worst.score.toFixed(1)}). Users are highly frustrated. `;
        analysis += `Recommendation: Prioritize communication and faster response times for ${worst.cause} issues immediately. `;
      } else if (worst.score < 0) {
        analysis += `"${worst.cause}" is showing mild negative sentiment. `;
      } else {
        analysis += `Overall sentiment is neutral or positive. `;
      }

      return analysis;
    }

    // Standard Charts (Chart.js instance)
    if (
        !chartInstance.data || 
        !chartInstance.data.datasets || 
        !chartInstance.data.datasets[0] || 
        !chartInstance.data.datasets[0].data ||
        chartInstance.data.datasets[0].data.length === 0
    ) {
      return "Insufficient data for detailed analysis.";
    }

    const data = chartInstance.data.datasets[0].data;
    const labels = chartInstance.data.labels;

    // Peak chart uses bubble points and does not rely on labels
    if (type === "peak") {
      const dataset = chartInstance.data.datasets[0].data;
      if (!dataset || dataset.length === 0) return "No peak data recorded.";

      const maxBubble = dataset.reduce((prev, current) =>
        prev.r > current.r ? prev : current
      , { r: 0 });

      if (maxBubble.r === 0) return "No significant peak times detected.";

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = days[maxBubble.y] || "Unknown Day";
      return `Highest outage frequency observed on ${dayName}s around ${maxBubble.x}:00 hours. Schedule additional standby crews during this window.`;
    }

    // 2. Safety Check: If labels are missing (for non-peak charts)
    if (!labels || labels.length === 0) {
      return "Data available, but labels are missing.";
    }

    // Helper to safely get the name associated with max value
    // FIX: Convert to numbers before finding max to ensure type safety
    const getMaxLabel = () => {
        const numData = data.map(d => Number(d) || 0);
        const maxVal = Math.max(...numData);
        
        if (maxVal === 0) return null; // If max is 0, no real data
        
        // Use index from number array
        const index = numData.indexOf(maxVal);
        const safeName = (labels && labels[index] !== undefined) ? labels[index] : "Unknown Area";
        
        return { name: safeName, val: maxVal };
    };

    const top = getMaxLabel();

    if (type === "rootCause") {
      if (!top) return "No incidents reported yet.";
      if (top.name.includes("Vegetation")) {
        return "Recommendation: Increase tree trimming schedule in high-risk corridors.";
      }
      if (top.name.includes("Equipment")) {
        return "Recommendation: Audit aging transformers and schedule preventive maintenance.";
      }
      return `Recommendation: Investigate high frequency of ${top.name} outages.`;
    }

    if (type === "mttr") {
      // Need at least 2 points for trend
      if (data.length < 2) return "Insufficient historical data for trend analysis.";
      const first = parseFloat(data[0]);
      const last = parseFloat(data[data.length - 1]);
      if (last < first) {
        return "Analysis: Repair times are trending DOWN (improving). Current maintenance strategies are effective.";
      }
      if (last > first) {
        return "Analysis: Repair times are trending UP (slower). Investigate dispatch delays or staffing shortages.";
      }
      return "Analysis: Repair times are stable.";
    }

    if (type === "feederCount") {
      if (!top) return "No outage data by feeder available.";
      return `${top.name} accounts for the highest volume of reports (${top.val}). Prioritize infrastructure inspection on this line.`;
    }

    if (type === "feederTime") {
      if (!top) return "No restoration time data available.";
      return `${top.name} has the slowest recovery time (${top.val.toFixed(2)} hrs avg). Check for access issues or equipment faults.`;
    }

    if (type === "barangay") {
      if (!top) return "No barangay impact data available.";
      return `${top.name} is the most frequently affected community. Engage with community leaders regarding upcoming improvements.`;
    }

    if (type === "feederForecast") {
      if (!top) return "Forecast: Risk data inconclusive.";
      return `Forecast: ${top.name} has the highest estimated probability of experiencing an outage in the next 7 days. Consider proactive inspection.`;
    }

    if (type === "barangayForecast") {
      if (!top) return "Forecast: Risk data inconclusive.";
      return `Forecast: ${top.name} is the barangay most at risk in the short term. Plan readiness with local officials.`;
    }

    if (type === "restorationForecast") {
      // restorationForecast uses fixed buckets [ <4h, 4-8h, ... ]
      // Check if data exists
      if (data.some(v => v > 0)) {
        const fastShare = (parseFloat(data[0]) + parseFloat(data[1]) || 0).toFixed(1);
        return `Forecast: Approximately ${fastShare}% of incidents are expected to be resolved within 8 hours based on historical performance.`;
      }
      return "Forecast: No restoration history available.";
    }

    return "Data visualization available in chart.";
  }

  async function generatePDFObject() {
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;

    // --- 1. LOAD LOGO & USER INFO ---
    let logoImg = null;
    try {
        logoImg = await loadImage("images/beneco.png");
    } catch(err) {
        console.warn("Logo load failed", err);
    }

    let adminEmail = "Authorized Account";
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
            adminEmail = user.email;
        }
    } catch(e) {
        console.error("Could not fetch user email", e);
    }

    // --- 2. CENTERED HEADER SECTION ---
    
    // Add Logo if loaded (Centered)
    if (logoImg) {
        const logoW = 25; 
        const logoH = 25; 
        // Calculate center position for image
        const xCentered = (pageWidth - logoW) / 2;
        
        doc.addImage(logoImg, "PNG", xCentered, 10, logoW, logoH);
        // FIX: Increase yPos significantly to avoid overlap
        yPos = 43; 
    } else {
        yPos = 20;
    }

    // Header Text (Centered)
    doc.setFontSize(24);
    doc.setTextColor(0, 123, 255);
    doc.setFont("helvetica", "bold");
    doc.text("BEACON SYSTEM REPORT", pageWidth / 2, yPos, { align: "center" });
    
    yPos += 5;
    
    // User Email & Date (Centered)
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated by: ${adminEmail} | Period: ${rangeStartInput.value} to ${rangeEndInput.value}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 10;

    // Warning box
    doc.setFillColor(255, 240, 240);
    doc.setDrawColor(200, 0, 0);
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 12, "FD");
    doc.setTextColor(200, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      "WARNING: CONFIDENTIAL DATA. AUTHORIZED PERSONNEL ONLY.",
      pageWidth / 2,
      yPos + 2,
      { align: "center" }
    );
    yPos += 15;

    // EXEC SUMMARY (tiles)
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text("1. Executive Summary (Selected Period)", margin, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const tVal =
      document.getElementById("value-total")?.textContent || "0";
    const tTrend =
      document.getElementById("trendPercent-total")?.textContent || "0";
    const aVal =
      document.getElementById("value-active")?.textContent || "0";
    const aTrend =
      document.getElementById("trendPercent-active")?.textContent || "0";
    const cVal =
      document.getElementById("value-completed")?.textContent || "0";
    const cTrend =
      document.getElementById("trendPercent-completed")?.textContent || "0";

    const boxWidth = (pageWidth - margin * 2) / 3;
    const boxH = 25;

    // Box 1 - Total
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, yPos, boxWidth - 2, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Total Reports", margin + 5, yPos + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.text(String(tVal), margin + 5, yPos + 18);
    doc.setFontSize(10);
    doc.setTextColor(
      tTrend.includes("-") ? 200 : 0,
      tTrend.includes("-") ? 0 : 150,
      0
    );
    doc.text(String(tTrend), margin + 20, yPos + 18);

    // Box 2 - Active
    doc.setTextColor(0);
    doc.setFillColor(245, 247, 250);
    doc.rect(margin + boxWidth, yPos, boxWidth - 2, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Active Outages", margin + boxWidth + 5, yPos + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.text(String(aVal), margin + boxWidth + 5, yPos + 18);
    doc.setFontSize(10);
    doc.text(String(aTrend), margin + boxWidth + 20, yPos + 18);

    // Box 3 - Completed
    doc.setTextColor(0);
    doc.setFillColor(245, 247, 250);
    doc.rect(margin + boxWidth * 2, yPos, boxWidth - 2, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Completed Repairs", margin + boxWidth * 2 + 5, yPos + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.text(String(cVal), margin + boxWidth * 2 + 5, yPos + 18);
    doc.setFontSize(10);
    doc.text(String(cTrend), margin + boxWidth * 2 + 20, yPos + 18);
    yPos += 35;

    // 3. CHARTS LOOP
    const allCharts = [
      { title: "2. Outages by Feeder", instance: feederChartInstance, type: "feederCount" },
      { title: "3. Avg Restoration Time by Feeder", instance: restorationChartInstance, type: "feederTime" },
      { title: "4. Root Cause Analysis", instance: rootCauseInstance, type: "rootCause" },
      { title: "5. Most Affected Barangays", instance: barangayImpactInstance, type: "barangay" },
      { title: "6. Peak Outage Times", instance: peakTimeInstance, type: "peak" },
      // REPLACED MTTR WITH SENTIMENT
      { title: "7. Root Cause Sentiment Analysis", instance: sentimentDataForPDF, type: "sentiment" },
      { title: "8. Feeder Risk Forecast (Next 7 Days)", instance: feederForecastInstance, type: "feederForecast" },
      { title: "9. Barangay Risk Forecast (Next 7 Days)", instance: barangayForecastInstance, type: "barangayForecast" },
      { title: "10. Restoration Likelihood", instance: restorationForecastInstance, type: "restorationForecast" },
    ];

    doc.setTextColor(0);
    allCharts.forEach((item) => {
      // --- A. SPECIAL HANDLING: SENTIMENT (Custom Drawing) ---
      if (item.type === "sentiment") {
        if (!item.instance || item.instance.length === 0) return;

        // Check page break (Sentiment block varies in height, estimate ~80-100 units)
        if (yPos + 80 > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(item.title, margin, yPos);
        yPos += 10;

        // Draw Bars manually
        item.instance.forEach((stat) => {
          // 1. Cause Label
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(60);
          doc.text(stat.cause, margin, yPos);

          // 2. Score Label
          const scoreText = stat.score.toFixed(1);
          let r=46, g=204, b=113; // Green
          if (stat.score <= -5) { r=231; g=76; b=60; } // Red
          else if (stat.score < 0) { r=241; g=196; b=15; } // Yellow

          doc.setTextColor(r, g, b);
          doc.text(scoreText, pageWidth - margin - 5, yPos, { align: 'right' });
          yPos += 3;

          // 3. Bar Background
          doc.setFillColor(229, 231, 235); // gray-200
          doc.rect(margin, yPos, pageWidth - margin*2, 4, 'F');

          // 4. Bar Foreground (Visualizing Magnitude of Negativity/Positivity)
          // To match HTML: width based on severity (abs value)
          const severity = Math.abs(stat.score);
          const pct = Math.min(severity / 10, 1); // Cap at 10
          const barWidth = (pageWidth - margin*2) * pct;

          if (barWidth > 0) {
            doc.setFillColor(r, g, b);
            doc.rect(margin, yPos, barWidth, 4, 'F');
          }
          yPos += 8; // Spacing for next item
        });

        yPos += 5;

        // Analysis Box
        doc.setFillColor(240, 248, 255);
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, yPos, pageWidth - margin * 2, 20, "DF");
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60);
        
        const analysisText = generateAnalysis(item.type, item.instance);
        const splitText = doc.splitTextToSize(
          analysisText,
          pageWidth - margin * 2 - 10
        );
        doc.text(splitText, margin + 5, yPos + 7);
        
        doc.setTextColor(0);
        yPos += 30;
        return; // Continue to next chart
      }

      // --- B. STANDARD CHART.JS CANVAS HANDLING ---
      // Skip chart if instance doesn't exist or data is empty
      if (!item.instance || !item.instance.data || !item.instance.data.datasets || !item.instance.data.datasets.length) {
          return;
      }

      const neededHeight = 130;
      if (yPos + neededHeight > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(item.title, margin, yPos);
      yPos += 6;

      try {
        const canvasImg = item.instance.toBase64Image();
        const imgWidth = 180;
        const imgHeight = 80;
        doc.addImage(canvasImg, "PNG", margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 5;

        doc.setFillColor(240, 248, 255);
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, yPos, pageWidth - margin * 2, 20, "DF");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60);
        
        // Generate Safe Analysis Text
        const analysisText = generateAnalysis(item.type, item.instance);
        
        const splitText = doc.splitTextToSize(
          analysisText,
          pageWidth - margin * 2 - 10
        );
        doc.text(splitText, margin + 5, yPos + 7);
        doc.setTextColor(0);
        yPos += 30;
      } catch (e) {
        console.error("Chart PDF generation error", e);
      }
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - 20,
        pageHeight - 10,
        { align: "right" }
      );
      doc.text("BEACON Internal Document - " + new Date().getFullYear(), margin, pageHeight - 10);
    }

    return doc;
  }

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
    const pdfBlob = currentPDFDoc.output("bloburl");
    iframe.src = pdfBlob;

    loading.classList.add("hidden");
    iframe.classList.remove("hidden");
  }

  function handlePreviewClose() {
    const modal = document.getElementById("pdfPreviewModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
    const iframe = document.getElementById("pdfPreviewFrame");
    if (iframe) iframe.src = "";
  }

  function handleDownload() {
    if (!currentPDFDoc) return;
    const dateStr = new Date().toISOString().split("T")[0];
    const adminName = "Report";
    currentPDFDoc.save(`BeaconReport_${adminName}_${dateStr}.pdf`);
    handlePreviewClose();
  }

  const triggerBtn = document.getElementById("downloadReportBtn");
  const closeBtn = document.getElementById("closePreviewBtn");
  const cancelBtn = document.getElementById("cancelPreviewBtn");
  const confirmBtn = document.getElementById("confirmDownloadBtn");

  if (triggerBtn) triggerBtn.addEventListener("click", handlePreviewOpen);
  if (closeBtn) closeBtn.addEventListener("click", handlePreviewClose);
  if (cancelBtn) cancelBtn.addEventListener("click", handlePreviewClose);
  if (confirmBtn) confirmBtn.addEventListener("click", handleDownload);

  // Init
  initDashboard();
});