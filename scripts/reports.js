// ==========================
// REPORTS PAGE SCRIPT - Ready connect sa backend
// ==========================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Reports Page Script (V13 - Contact & Attach Update) Loaded.");

  // --- App State ---
  let allReports = []; // Will hold all reports from Supabase

  // Config data
  const STATUS_COLORS = {
    PENDING: { primary: "bg-yellow-500", value: "text-yellow-600", tag: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100" },
    Reported: { primary: "bg-red-500", value: "text-red-600", tag: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100" },
    Ongoing: { primary: "bg-blue-500", value: "text-blue-600", tag: "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100" },
    Completed: { primary: "bg-green-500", value: "text-green-600", tag: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" }
  };

  // --- Element References ---
  const feederTilesContainer = document.getElementById("feederTiles");
  const reportsContainer = document.getElementById("reportsContainer");
  const reportsBody = document.getElementById("reportsBody");
  const reportsThead = document.getElementById("reportsThead");
  const reportsTitle = document.getElementById("reportsTitle");
  const backBtn = document.getElementById("backBtn");
  const createAnnouncementBtn = document.getElementById("createAnnouncementBtn"); 
  const attachToAnnouncementBtn = document.getElementById("attachToAnnouncementBtn"); // NEW: The + Button
  const bulkUpdateBtn = document.getElementById("bulkUpdateBtn");

  const statusFilterEl = document.getElementById('statusFilter');
  const sortFilterEl = document.getElementById('sortFilter');
  const searchInputEl = document.getElementById('searchInput');
  const sortWithPicturesEl = document.getElementById('sortWithPictures');
  const sortWithCoordsEl = document.getElementById('sortWithCoords');

  const showingCountEl = document.getElementById('showingCount');
  const totalCountEl = document.getElementById('totalCount');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  const emptyState = document.getElementById('emptyState');

  // --- App State ---
  let currentView = 'feeders';
  let currentFeederId = null;
  let currentBarangay = null;
  let allFeederData = {};
  let currentDisplayData = [];
  let selectedItems = new Set();
  let currentPage = 1;
  const itemsPerPage = 12;

  // ===================================
  // COPY FUNCTIONS
  // ===================================
  function handleCopyCoords(e) {
    const btn = e.target.closest('.copy-coords-btn');
    if (!btn) return;

    const coords = btn.dataset.coords;
    if (!coords || coords === 'Undetermined' || coords === 'N/A') return;

    navigator.clipboard.writeText(coords).then(() => {
      window.showSuccessPopup("Coordinates Copied!"); 
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<span class="material-icons text-sm text-green-600">check</span>';
      setTimeout(() => {
        if (btn && btn.parentNode) {
            btn.innerHTML = originalHTML;
        }
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy coordinates:', err);
    });
  }

  function handleCopyContact(e) {
    const btn = e.target.closest('.copy-contact-btn');
    if (!btn) return;

    const number = btn.dataset.contact;
    if (!number) return;

    navigator.clipboard.writeText(number).then(() => {
      window.showSuccessPopup("Number Copied!"); 
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<span class="material-icons text-sm text-green-600">check</span>';
      setTimeout(() => {
        if (btn && btn.parentNode) {
            btn.innerHTML = originalHTML;
        }
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy contact:', err);
    });
  }

  // ===================================
  // INITIALIZATION
  // ===================================
  async function init() {
    createFeederTiles();
    
    // Fetch all report data from Supabase first
    await fetchAllReports();
    
    // DEBUG: Check image URLs
    console.log('=== IMAGE DEBUG INFO ===');
    allReports.forEach((report, index) => {
      if (report.images && report.images.length > 0) {
        console.log(`Report ${index}:`, {
          id: report.id,
          imageCount: report.images.length,
          imageUrls: report.images
        });
      }
    });
    
    // Now that data is loaded, proceed with aggregation and UI setup
    loadAndAggregateFeederData();
    attachEventListeners();
    showFeederTilesView();
    console.log("Reports system initialized");
  }

  // ===================================
  // DATA LOADING & AGGREGATION
  // ===================================

  /**
   * Fetches all reports from Supabase and stores them in the `allReports` variable.
   */
  async function fetchAllReports() {
    console.log("Fetching all reports from Supabase...");
    if (!window.supabase) {
      console.error("Supabase client not found.");
      feederTilesContainer.innerHTML = `<p class="text-red-500 col-span-full">Error: Supabase connection failed.</p>`;
      return;
    }

    try {
      // 1. Fetch from 'reports' and join related tables
      // Added contact_number and contact_permission to selection
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          feeder_id,
          barangays ( name ),
          report_images ( image_url )
        `);
        
      if (error) {
        throw error;
      }
      
      // 2. Transform the raw DB data to match what your JS logic expects
      allReports = (data || []).map(r => {
        // Helper to capitalize status (e.g., "completed" -> "Completed")
        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Unknown';
        
        // Process status to match your STATUS_COLORS keys
        let processedStatus = 'UNKNOWN';
        if (r.status) {
          processedStatus = r.status.toLowerCase() === 'pending' 
            ? 'PENDING' // Fix for 'pending' vs 'PENDING'
            : capitalize(r.status);
        }

        // FIXED: Better image URL handling
        const images = (r.report_images || []).map(img => {
          // If it's already a full URL, use it directly
          if (img.image_url.startsWith('http')) {
            return img.image_url;
          }
          // If it's a storage path, construct the public URL
          const { data: publicUrlData } = supabase.storage
            .from('report_images')
            .getPublicUrl(img.image_url);
          return publicUrlData.publicUrl;
        });

        return {
          ...r,
          // CONFLICT FIX 1: Your code expects `feeder` (number)
          feeder: r.feeder_id,
          
          // CONFLICT FIX 2: Your code expects `barangay` (string name)
          barangay: r.barangays ? r.barangays.name : 'Unknown Barangay',
          
          // CONFLICT FIX 3: Your code expects `status` (uppercase 'PENDING')
          status: processedStatus,

          // CONFLICT FIX 4: Your code expects `volume` (number) for aggregation
          volume: 1, // Set to 1 as a counter
          
          // CONFLICT FIX 5: Your code expects `images` (array of strings)
          images: images // This now contains full URLs
        };
      });

      console.log(`Fetched and transformed ${allReports.length} total reports.`);

    } catch (error) {
      console.error("Error fetching reports:", error.message);
      feederTilesContainer.innerHTML = `<p class="text-red-500 col-span-full">Error loading reports: ${error.message}</p>`;
    }
  }


  /**
   * Helper function to get ONLY the "PENDING" items from the live data.
   * Made globally available for unified modal system
   */
  function getPendingItems() {
    // This function is UNCHANGED and now works because fetchAllReports()
    // correctly transforms 'pending' to 'PENDING'.
    return allReports.filter(r => r.status === 'PENDING');
  }

  // Make getPendingItems globally available for the unified modal system
  window.getPendingItems = getPendingItems;

  function loadAndAggregateFeederData() {
    const feederAggregates = {};
    for (let i = 1; i <= 14; i++) {
      feederAggregates[i] = { reports: [], status: "Completed", reportCount: 0 };
    }

    // *** Only aggregate "PENDING" items ***
    getPendingItems().forEach(report => {
      if (feederAggregates[report.feeder]) {
        feederAggregates[report.feeder].reports.push(report);
        feederAggregates[report.feeder].reportCount++;
      }
    });

    // Determine aggregate status (PENDING or Completed)
    for (const feederId in feederAggregates) {
      feederAggregates[feederId].status = (feederAggregates[feederId].reportCount > 0) ? "PENDING" : "Completed";
    }

    allFeederData = feederAggregates;
    updateFeederTilesUI();
  }

  function aggregateBarangayData(feederId) {
    const barangayGroups = {};

    // *** Only filter "PENDING" items for this feeder ***
    getPendingItems()
      .filter(report => report.feeder === feederId)
      .forEach(report => {
        if (!barangayGroups[report.barangay]) {
          barangayGroups[report.barangay] = {
            barangay: report.barangay,
            reports: [],
            totalVolume: 0,
            causes: {},
            status: "PENDING",
            coordinates: null
          };
        }
        const group = barangayGroups[report.barangay];
        group.reports.push(report);
        group.totalVolume += report.volume || 0;
        const cause = report.cause || "Undetermined";
        group.causes[cause] = (group.causes[cause] || 0) + 1;

        if (report.latitude && report.longitude && !group.coordinates) {
          group.coordinates = `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`;
        }
      });
      return Object.values(barangayGroups).map(group => {
      let commonCause = "N/A";
      let maxCount = 0;
      Object.entries(group.causes).forEach(([cause, count]) => {
        if (count > maxCount) {
          commonCause = cause;
          maxCount = count;
        }
      });
      return {
        id: group.barangay,
        barangay: group.barangay,
        volume: group.totalVolume,
        commonCause: commonCause,
        status: "PENDING",
        reportCount: group.reports.length,
        coordinates: group.coordinates
      };
    });
  }

  function getIndividualReports(barangayName) {
    // *** Only return "PENDING" items for this barangay ***
    return getPendingItems().filter(report => report.barangay === barangayName);
  }

  // ===================================
  // VIEW MANAGEMENT
  // ===================================

  function showFeederTilesView() {
    currentView = 'feeders';
    currentFeederId = null;
    currentBarangay = null;
    feederTilesContainer.classList.remove("hidden");
    reportsContainer.classList.add("hidden");
    reportsTitle.textContent = "Pending Reports";
    sortFilterEl.value = 'id';
    searchInputEl.value = '';

    if (statusFilterEl) statusFilterEl.closest('.relative').classList.add('hidden'); 

    sortWithPicturesEl.classList.add('hidden');
    sortWithCoordsEl.classList.add('hidden');
    
    // Hide attach button in main view if not needed, or keep it.
    // Usually attach makes sense when inside a feeder context, but keeping logical flow.
    if(attachToAnnouncementBtn) attachToAnnouncementBtn.classList.add('hidden');

    resetSelections();
  }

  function showBarangayView(feederId) {
    currentView = 'barangays';
    currentFeederId = feederId;
    currentBarangay = null;
    currentPage = 1;

    currentDisplayData = aggregateBarangayData(feederId);

    feederTilesContainer.classList.add("hidden");
    reportsContainer.classList.remove("hidden");
    reportsTitle.textContent = `Pending Reports - Feeder ${feederId}`;

    if (statusFilterEl) statusFilterEl.closest('.relative').classList.add('hidden');

    sortWithPicturesEl.classList.add('hidden');
    sortWithCoordsEl.classList.add('hidden');
    
    // Show attach button in feeder view
    if(attachToAnnouncementBtn) attachToAnnouncementBtn.classList.remove('hidden');

    updateTableHeaders();
    applyFiltersAndRender();
    resetSelections();
  }

  function showIndividualView(barangayName) {
    currentView = 'individuals';
    currentBarangay = barangayName;
    currentPage = 1;

    currentDisplayData = getIndividualReports(barangayName);

    reportsTitle.textContent = `Pending Reports - ${barangayName}`;

    if (statusFilterEl) statusFilterEl.closest('.relative').classList.add('hidden');

    sortWithPicturesEl.classList.remove('hidden');
    sortWithCoordsEl.classList.remove('hidden');
    
    // Show attach button in individual view
    if(attachToAnnouncementBtn) attachToAnnouncementBtn.classList.remove('hidden');

    updateTableHeaders();
    applyFiltersAndRender();
    resetSelections();
  }

  async function refreshCurrentView() {
    // Re-fetch all data from Supabase
    await fetchAllReports();

    // Re-aggregate and update UI based on new data
    loadAndAggregateFeederData();

    if (currentView === 'feeders') {
      showFeederTilesView();
    } else if (currentView === 'barangays') {
      currentDisplayData = aggregateBarangayData(currentFeederId);
      applyFiltersAndRender();
    } else if (currentView === 'individuals') {
      currentDisplayData = getIndividualReports(currentBarangay);
      applyFiltersAndRender();
    }
    
    resetSelections();
  }

  // Make refreshCurrentView globally available for the unified modal system
  window.refreshCurrentView = refreshCurrentView;
    // ===================================
  // UI & TABLE RENDERING
  // ===================================

  function createFeederTiles() {
      // Initial loading state
      feederTilesContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12 animate-pulse">Loading Feeder Infrastructure...</div>';
    }

  function updateFeederTilesUI() {
    let tilesHTML = "";

    for (let feederId = 1; feederId <= 14; feederId++) {
      // Get data from aggregated state or default to 0
      const data = allFeederData[feederId] || { reportCount: 0 };
      const count = data.reportCount;
      const hasOutages = count > 0;

      // --- DYNAMIC STYLING LOGIC ---
      const statusColor = hasOutages ? 'bg-red-500' : 'bg-blue-500';
      const hoverColor = hasOutages ? 'group-hover:bg-red-600' : 'group-hover:bg-blue-600';
      
      // Badge Pill Style
      const badgeStyle = hasOutages 
        ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' 
        : 'bg-gray-50 text-gray-500 border-gray-100 dark:bg-gray-700/30 dark:text-gray-400 dark:border-gray-600';
      
      // Ping Animation for active outages
      const pingAnimation = hasOutages 
        ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>` 
        : '';
      
      const dotColor = hasOutages ? 'bg-red-500' : 'bg-gray-400';
      
      // Format ID (e.g., "01" instead of "1")
      const formattedId = feederId < 10 ? '0' + feederId : feederId;

      // --- NEW CARD HTML ---
      tilesHTML += `
        <div class="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-40 w-full feeder-tile"
             data-feeder-id="${feederId}">
          
          <div class="absolute left-0 top-0 bottom-0 w-1.5 ${statusColor} group-hover:w-3 transition-all duration-300"></div>

          <div class="h-full px-6 py-5 pl-8 flex flex-col justify-between relative z-10">
             
             <div class="flex justify-between items-start">
                <div>
                   <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Substation Area</p>
                   <h3 class="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Feeder ${feederId}</h3>
                </div>
                
                <div class="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center text-gray-400 ${hoverColor} group-hover:text-white transition-all duration-300 shadow-inner">
                   <span class="material-icons">bolt</span>
                </div>
             </div>

             <div class="flex items-center justify-between mt-auto">
                <div class="px-3 py-1.5 rounded-lg border ${badgeStyle} text-xs font-bold flex items-center gap-2">
                   <span class="relative flex h-2.5 w-2.5">
                     ${pingAnimation}
                     <span class="relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}"></span>
                   </span>
                   <span>${count} Pending</span>
                </div>
                
                <span class="material-icons text-gray-300 group-hover:text-blue-500 group-hover:translate-x-2 transition-transform duration-300 text-lg">arrow_forward</span>
             </div>
          </div>

          <div class="absolute -right-4 -bottom-8 text-[6rem] font-black text-gray-50 dark:text-gray-700/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none select-none leading-none z-0">
             ${formattedId}
          </div>
        </div>
      `;
    }
    feederTilesContainer.innerHTML = tilesHTML;
  }

  function updateTableHeaders() {
    let headerHTML = '';
    const thClass = "py-3 px-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300";

    if (currentView === 'barangays') {
      headerHTML = `
        <th class="${thClass} w-10">
          <input type="checkbox" id="selectAllCheckbox" class="h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300">
        </th>
        <th class="${thClass}">Barangay</th>
        <th class="${thClass}">Reports</th>
        <th class="${thClass}">Most Common Cause</th>
        <th class="${thClass}">Status</th>
        <th class="${thClass}">Coordinates</th>
        <th class="${thClass}">Actions</th>
      `;
    } else if (currentView === 'individuals') {
      headerHTML = `
        <th class="${thClass} w-10">
          <input type="checkbox" id="selectAllCheckbox" class="h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300">
        </th>
        <th class="${thClass}">Report ID</th>
        <th class="${thClass}">Timestamp</th>
        <th class="${thClass}">Description</th>
        <th class="${thClass}">Status</th>
        <th class="${thClass}">Contact</th> <!-- NEW COLUMN -->
        <th class="${thClass}">Image</th>
        <th class="${thClass}">Coordinates</th>
        <th class="${thClass}">Actions</th>
      `;
    }
    reportsThead.innerHTML = headerHTML;

    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    }
  }

  function renderTable(data) {
    if (data.length === 0) {
      reportsBody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    let tableHTML = '';
    if (currentView === 'barangays') {
      tableHTML = paginatedData.map(renderBarangayRow).join('');
    } else if (currentView === 'individuals') {
      tableHTML = paginatedData.map(renderIndividualRow).join('');
    }

    reportsBody.innerHTML = tableHTML;
    updateSelectedUI();
  }

  function renderBarangayRow(group) {
    const statusColor = STATUS_COLORS[group.status] || STATUS_COLORS.PENDING;
    const isSelected = selectedItems.has(group.id);
    const coordsText = group.coordinates || 'Undetermined';

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td class="py-3 px-4">
          <input type="checkbox" class="report-checkbox h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300"
                 data-id="${group.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="py-3 px-4 font-medium">${group.barangay}</td>
        <td class="py-3 px-4">${group.reportCount}</td>
        <td class="py-3 px-4 truncate max-w-xs" title="${group.commonCause}">${group.commonCause}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.tag}">
            ${group.status}
          </span>
        </td>
        <td class="py-3 px-4">
          ${group.coordinates ?
            `<div class="flex items-center space-x-1">
              <span title="${coordsText}">${coordsText}</span>
              <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}">
                <span class="material-icons text-sm">content_copy</span>
              </button>
            </div>` :
            'Undetermined'
          }
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition mr-2 view-barangay-btn" data-id="${group.id}">View</button>
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-full hover:bg-red-700 transition update-item-btn" data-id="${group.id}">Update</button>
        </td>
      </tr>
    `;
  }

  function renderIndividualRow(report) {
    const statusColor = STATUS_COLORS[report.status] || STATUS_COLORS.PENDING;
    const isSelected = selectedItems.has(report.id);
    const reportDate = new Date(report.created_at).toLocaleString();
    const hasImages = report.images && report.images.length > 0;
    const hasCoords = report.latitude && report.longitude;
    const coordsText = hasCoords ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}` : 'N/A';
    
    // Check permission and existence for contact info
    const showContact = report.contact_permission && report.contact_number;

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td class="py-3 px-4">
          <input type="checkbox" class="report-checkbox h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300"
                 data-id="${report.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="py-3 px-4 font-medium">${report.id.substring(0, 8)}...</td>
        <td class="py-3 px-4">${reportDate}</td>
        <td class="py-3 px-4 truncate max-w-xs" title="${report.description}">${report.description}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.tag}">
            ${report.status}
          </span>
        </td>
        <!-- NEW CONTACT COLUMN -->
        <td class="py-3 px-4">
          ${showContact ?
            `<div class="flex items-center space-x-1">
              <span title="${report.contact_number}">${report.contact_number}</span>
              <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-contact-btn" data-contact="${report.contact_number}">
                <span class="material-icons text-sm">content_copy</span>
              </button>
            </div>` :
            '<span class="text-gray-400 italic text-sm">N/A</span>'
          }
        </td>
        <td class="py-3 px-4">
          ${hasImages ?
            `<button type="button" class="text-blue-600 dark:text-blue-400 hover:underline view-images-btn" data-images='${JSON.stringify(report.images)}'>View (${report.images.length})</button>` :
            'N/A'
          }
        </td>
        <td class="py-3 px-4">
          ${hasCoords ?
            `<div class="flex items-center space-x-1">
              <span title="${coordsText}">${coordsText}</span>
              <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}">
                <span class="material-icons text-sm">content_copy</span>
              </button>
            </div>` :
            'N/A'
          }
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition mr-2 view-details-btn" data-id="${report.id}">Details</button>
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-full hover:bg-red-700 transition update-item-btn" data-id="${report.id}">Update</button>
        </td>
      </tr>
    `;
  }

  // ===================================
  // FILTERING & PAGINATION
  // ===================================

  function applyFiltersAndRender(keepPage = false) {
    const sort = sortFilterEl.value;
    const search = searchInputEl.value.toLowerCase();

    let filteredData = [...currentDisplayData];

    // --- Filter by search ---
    if (search) {
        filteredData = filteredData.filter(item => {
            if (currentView === 'barangays') {
                return item.barangay.toLowerCase().includes(search) ||
                       item.commonCause.toLowerCase().includes(search) ||
                       (item.coordinates && item.coordinates.toLowerCase().includes(search));
            }
            if (currentView === 'individuals') {
                // Expanded search to include contact number if visible
                const contactSearch = (item.contact_permission && item.contact_number) ? item.contact_number.includes(search) : false;
                
                return item.description.toLowerCase().includes(search) ||
                       String(item.id).includes(search) ||
                       (item.latitude && item.longitude &&
                        `${item.latitude},${item.longitude}`.includes(search)) ||
                        contactSearch;
            }
            return false;
        });
    }

    // --- Sort ---
    switch (sort) {
        case 'id':
            filteredData.sort((a, b) => a.id > b.id ? 1 : -1);
            break;
        case 'volume-high':
            filteredData.sort((a, b) => currentView === 'barangays' ? b.reportCount - a.reportCount : b.id - a.id);
            break;
        case 'volume-low':
            filteredData.sort((a, b) => currentView === 'barangays' ? a.reportCount - b.reportCount : a.id - b.id);
            break;
        case 'with-pictures':
            if (currentView === 'individuals') {
                filteredData.sort((a, b) => (b.images?.length || 0) - (a.images?.length || 0));
            }
            break;
        case 'with-coordinates':
            filteredData.sort((a, b) => {
                const aHas = a.coordinates || (a.latitude && a.longitude);
                const bHas = b.coordinates || (b.latitude && b.longitude);
                return aHas && !bHas ? -1 : !aHas && bHas ? 1 : 0;
            });
            break;
        // NEW FILTER OPTION
        case 'with-contact': 
             if (currentView === 'individuals') {
                filteredData.sort((a, b) => {
                    const aHas = a.contact_permission && a.contact_number;
                    const bHas = b.contact_permission && b.contact_number;
                    return bHas - aHas; // Sort true (has contact) before false
                });
             }
             break;
    }

    if (!keepPage) currentPage = 1;

    renderTable(filteredData);
    updatePaginationUI(filteredData);
  }

  function changePage(direction) {
    const totalItems = getFilteredData().length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (direction === 'next' && currentPage < totalPages) currentPage++;
    else if (direction === 'prev' && currentPage > 1) currentPage--;

    applyFiltersAndRender(true); // Keep current page
    resetSelections();
  }

  function updatePaginationUI(data) {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    showingCountEl.textContent = Math.min(itemsPerPage, data.length);
    totalCountEl.textContent = totalItems;
    
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  function getFilteredData() {
     const search = searchInputEl.value.toLowerCase();
     let filteredData = [...currentDisplayData]; // Already PENDING items
     if (search) {
       filteredData = filteredData.filter(item => {
         if (currentView === 'barangays') return item.barangay.toLowerCase().includes(search) || item.commonCause.toLowerCase().includes(search) || (item.coordinates && item.coordinates.toLowerCase().includes(search));
         if (currentView === 'individuals') return item.description.toLowerCase().includes(search) || String(item.id).includes(search) || (item.latitude && item.longitude && `${item.latitude},${item.longitude}`.includes(search));
         return false;
       });
     }
     return filteredData;
  }

  // ===================================
  // SELECTION HANDLING
  // ===================================
  function resetSelections() {
    selectedItems.clear();
    updateSelectedUI();
  }

  function handleSelectAllChange(e) {
    const isChecked = e.target.checked;
    const checkboxes = reportsBody.querySelectorAll('.report-checkbox');

    checkboxes.forEach(cb => {
      // --- FIX: Check view before parseInt ---
      const id = (currentView === 'barangays') ? cb.dataset.id : cb.dataset.id; // Always treat id as string from dataset
      if (isChecked) {
        selectedItems.add(id);
      } else {
        selectedItems.delete(id);
      }
    });
    updateSelectedUI();
  }

  function handleCheckboxChange(e) {
    const checkbox = e.target;
    // --- FIX: Check view before parseInt ---
    const id = (currentView === 'barangays') ? checkbox.dataset.id : checkbox.dataset.id; // Always treat id as string from dataset

    if (checkbox.checked) {
      selectedItems.add(id);
    } else {
      selectedItems.delete(id);
    }
    updateSelectedUI();
  }

  function updateSelectedUI() {
    reportsBody.querySelectorAll('.report-checkbox').forEach(cb => {
      // --- FIX: Check view before parseInt ---
      const id = (currentView === 'barangays') ? cb.dataset.id : cb.dataset.id; // Always treat id as string from dataset
      cb.checked = selectedItems.has(id);
    });

    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      const allCheckboxes = reportsBody.querySelectorAll('.report-checkbox');
      const allVisibleChecked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);

      selectAllCheckbox.checked = allVisibleChecked;
      selectAllCheckbox.indeterminate = selectedItems.size > 0 && !allVisibleChecked;
    }

    const hasSelection = selectedItems.size > 0;
    bulkUpdateBtn.classList.toggle('hidden', !hasSelection);
    bulkUpdateBtn.textContent = `Update Selected (${selectedItems.size})`;
    
    // Also toggle the Attach button style if needed (visual feedback)
    if(attachToAnnouncementBtn) {
        // attachToAnnouncementBtn.disabled = !hasSelection;
        // Optional: Change style if no items are selected
        if(!hasSelection) {
            attachToAnnouncementBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            attachToAnnouncementBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
  }
    // ===================================
  // ATTACH TO ANNOUNCEMENT FUNCTIONALITY (NEW)
  // ===================================
  
  async function fetchRecentOutages(feederId) {
      try {
          // REVISION: Fetch from 'announcements' table
          // Filter: Last 24 hours, matching feeder_id
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

          const { data, error } = await supabase
              .from('announcements') // Changed from 'outages' to 'announcements'
              .select('*')
              .eq('feeder_id', feederId)
              .gte('created_at', twentyFourHoursAgo) // Filter strictly for last 24 hours
              .order('created_at', { ascending: false });
              
          if (error) throw error;
          return data || [];
      } catch (err) {
          console.error("Error fetching announcements for attach:", err);
          return [];
      }
  }

  async function showAttachModal(feederId) {
      const outages = await fetchRecentOutages(feederId);
      
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
      
      let rowsHTML = '';
      if (outages.length === 0) {
          rowsHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">No recent announcements found for Feeder ' + feederId + ' (Last 24h)</td></tr>';
      } else {
          rowsHTML = outages.map(outage => {
            const date = new Date(outage.created_at).toLocaleString();
            // Determine status color for badge
            let badgeClass = "bg-gray-100 text-gray-800";
            if(outage.status === 'Reported') badgeClass = "bg-red-100 text-red-800";
            if(outage.status === 'Ongoing') badgeClass = "bg-blue-100 text-blue-800";
            if(outage.status === 'Completed') badgeClass = "bg-green-100 text-green-800";

            return `
              <tr class="hover:bg-blue-50 cursor-pointer transition border-b border-gray-100 last:border-0 outage-row" data-id="${outage.id}">
                  <td class="px-4 py-3">
                      <input type="radio" name="selectedOutage" value="${outage.id}" class="h-4 w-4 text-blue-600 focus:ring-blue-500">
                  </td>
                  <td class="px-4 py-3 font-medium text-gray-900">${outage.cause || 'Unknown Cause'}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">${outage.location || 'N/A'}</td> <!-- NEW -->
                  <td class="px-4 py-3 text-sm text-gray-600">Feeder ${outage.feeder_id || 'N/A'}</td> <!-- NEW -->
                  <td class="px-4 py-3">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}">
                        ${outage.status}
                      </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
              </tr>
            `;
          }).join('');
      }

      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden transform transition-all">
          <div class="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span class="material-icons text-blue-500">link</span>
                Attach to Announcement
            </h3>
            <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 close-modal">
                <span class="material-icons">close</span>
            </button>
          </div>
          
          <div class="p-4">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select an existing announcement from the last 24 hours to attach the selected report(s) to.
            </p>
            
            <div class="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="w-8 px-4 py-2"></th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cause</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Feeder</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>
          </div>
          
          <div class="flex justify-end gap-3 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 close-modal">
                Cancel
            </button>
            <button type="button" id="confirmAttachBtn" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                Attach Reports
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);

      // --- Attach Logic Event Listeners ---
      
      // Close Modal
      modal.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => modal.remove()));

      // Row Click Selection
      modal.querySelectorAll('.outage-row').forEach(row => {
          row.addEventListener('click', (e) => {
             // If clicked directly on radio, don't trigger row click (default behavior handles it)
             if(e.target.type === 'radio') return;
             
             const radio = row.querySelector('input[type="radio"]');
             if(radio) radio.checked = true;
          });
      });

      // Confirm Attach
      const confirmBtn = modal.querySelector('#confirmAttachBtn');
      confirmBtn.addEventListener('click', async () => {
          const selectedRadio = modal.querySelector('input[name="selectedOutage"]:checked');
          
          if(!selectedRadio) {
              window.showErrorPopup ? window.showErrorPopup("Please select an announcement.") : alert("Please select an announcement.");
              return;
          }
          
          // RESOLVE IDs BASED ON VIEW
          // This fixes the "invalid input syntax for type uuid" error when in Barangay view
          let reportIdsToAttach = [];
          
          if (currentView === 'barangays') {
             // selectedItems are Barangay Names (e.g., "Camp 7")
             const selectedBarangays = Array.from(selectedItems);
             
             // Find all PENDING reports for these barangays in the current feeder
             // Note: currentFeederId is available in scope
             const reportsToAttach = allReports.filter(r => 
                 r.feeder === currentFeederId && 
                 r.status === 'PENDING' && 
                 selectedBarangays.includes(r.barangay)
             );
             
             if(reportsToAttach.length === 0) {
                 alert("No pending reports found for selected barangays.");
                 return;
             }
             reportIdsToAttach = reportsToAttach.map(r => r.id);
             
          } else {
             // selectedItems are Report IDs (individuals view)
             reportIdsToAttach = Array.from(selectedItems);
          }

          const announcementId = selectedRadio.value;
          
          confirmBtn.textContent = "Attaching...";
          confirmBtn.disabled = true;
          
          try {
             // 1. Fetch current announcement data to get existing report_ids
             const { data: currentAnnouncement, error: fetchError } = await supabase
                 .from('announcements')
                 .select('report_ids')
                 .eq('id', announcementId)
                 .single();

             if (fetchError) throw fetchError;

             // 2. Merge existing IDs with new IDs (avoid duplicates)
             const existingIds = currentAnnouncement.report_ids || [];
             // Ensure uniqueness and valid type (assuming IDs are strings/UUIDs)
             const updatedReportIds = [...new Set([...existingIds, ...reportIdsToAttach])];

             // 3. Update the announcement
             const { error: updateError } = await supabase
                 .from('announcements')
                 .update({ report_ids: updatedReportIds })
                 .eq('id', announcementId);

             if (updateError) throw updateError;

             // 4. Update the actual reports to status 'Reported' so they are cleared from Pending view
             // This is required to remove them from the "Pending Reports" list
             const { error: reportUpdateError } = await supabase
                 .from('reports')
                 .update({ 
                     status: 'Reported' 
                 })
                 .in('id', reportIdsToAttach);
                 
             if(reportUpdateError) throw reportUpdateError;
             
             window.showSuccessPopup ? window.showSuccessPopup("Reports successfully attached!") : alert("Reports Attached!");
             modal.remove();
             refreshCurrentView(); // Reload list
             
          } catch (err) {
              console.error("Attach failed:", err);
              window.showErrorPopup ? window.showErrorPopup("Failed to attach reports: " + err.message) : alert("Failed: " + err.message);
              confirmBtn.textContent = "Attach Reports";
              confirmBtn.disabled = false;
          }
      });
  }


  // ===================================
  // MODAL INTEGRATION WITH UNIFIED SYSTEM
  // ===================================

  function hasCoords(report) { return report && report.latitude && report.longitude; }

  function showIndividualDetails(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (!report) {
      console.error("Could not find report with ID:", reportId);
      return;
    }
    
    const coordsText = hasCoords(report) ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}` : '';
    
    // FIXED: Better image display with error handling
    let imagesHTML = '';
    if (report.images && report.images.length > 0) {
      imagesHTML = `
        <div class="grid grid-cols-3 gap-2 mt-2">
          ${report.images.map((img, index) => `
            <img src="${img}" 
                 alt="Report image ${index + 1}" 
                 class="w-full h-24 object-cover rounded cursor-pointer hover:opacity-75 view-popup-image"
                 onerror="this.style.display='none'"
                 data-index="${index}">
          `).join('')}
        </div>
      `;
    } else {
      imagesHTML = '<p class="text-gray-500 dark:text-gray-400 mt-1">No images submitted</p>';
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Report Details #${report.id.substring(0,8)}</h3>
          <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 close-modal"><span class="material-icons">close</span></button>
        </div>
        <div class="p-6 space-y-4 overflow-y-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Barangay</label><p class="text-lg text-gray-900 dark:text-white">${report.barangay}</p></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${STATUS_COLORS[report.status].tag}">${report.status}</span></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Volume</label><p class="text-lg text-gray-900 dark:text-white">${report.volume || 'N/A'}</p></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Cause</label><p class="text-lg text-gray-900 dark:text-white">${report.cause || 'Undetermined'}</p></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Contact</label><p class="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                ${(report.contact_permission && report.contact_number) 
                    ? `<span>${report.contact_number}</span> 
                       <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-contact-btn" data-contact="${report.contact_number}"><span class="material-icons text-sm">content_copy</span></button>` 
                    : '<span class="text-gray-400 italic text-sm">Not Available/Hidden</span>'}
            </p></div>
          </div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><p class="text-gray-900 dark:text-white mt-1">${report.description || 'No description provided'}</p></div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Images (${report.images ? report.images.length : 0})
            </label>
            ${imagesHTML}
          </div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Coordinates</label>${hasCoords(report) ? `<div class="flex items-center space-x-2 mt-1"><span class="text-gray-900 dark:text-white">${coordsText}</span><button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}"><span class="material-icons text-sm">content_copy</span></button></div>` : '<p class="text-gray-500 dark:text-gray-400 mt-1">No coordinates submitted</p>'}</div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Reported At</label><p class="text-gray-900 dark:text-white">${new Date(report.created_at).toLocaleString()}</p></div>
        </div>
        <div class="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition close-modal">Close</button>
          <button type="button" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition update-from-details" data-id="${report.id}">Update</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.querySelector('.update-from-details').addEventListener('click', function() {
      const reportId = this.dataset.id; 
      selectedItems.clear(); 
      selectedItems.add(reportId); 
      modal.remove(); 
      window.showUpdateModal([reportId], 'reports', {
        currentView: currentView,
        currentFeederId: currentFeederId,
        currentBarangay: currentBarangay
      });
    });
    modal.querySelectorAll('.copy-coords-btn').forEach(btn => btn.addEventListener('click', handleCopyCoords));
    modal.querySelectorAll('.copy-contact-btn').forEach(btn => btn.addEventListener('click', handleCopyContact));
    
    // FIXED: Only add click listeners to images that actually loaded
    modal.querySelectorAll('.view-popup-image').forEach((img, idx) => {
      img.addEventListener('click', () => {
        // Filter out images that failed to load
        const validImages = report.images.filter((_, index) => {
          const imgElement = modal.querySelector(`[data-index="${index}"]`);
          return imgElement && imgElement.naturalWidth > 0;
        });
        if (validImages.length > 0) {
          showImageModal(validImages, idx);
        }
      });
    });
  }

  function showImageModal(images, startIndex = 0) {
    if (!Array.isArray(images) || images.length === 0) return;

    let currentIndex = startIndex;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4';

    function renderImage() {
      modal.innerHTML = `
        <div class="relative max-w-3xl max-h-[90vh] flex items-center justify-center">
          <button type="button" class="absolute left-2 text-white text-3xl font-bold z-10 bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center" ${currentIndex === 0 ? 'disabled style="opacity:0.5"' : ''}>&#10094;</button>
          <img src="${images[currentIndex]}" class="w-full h-auto object-contain max-h-[90vh] rounded-lg">
          <button type="button" class="absolute right-2 text-white text-3xl font-bold z-10 bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center" ${currentIndex === images.length - 1 ? 'disabled style="opacity:0.5"' : ''}>&#10095;</button>
          <button type="button" class="absolute top-2 right-2 text-white text-3xl font-bold bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center">&times;</button>
          <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm">
            ${currentIndex + 1} / ${images.length}
          </div>
        </div>
      `;

      const [prevBtn, nextBtn, closeBtn] = modal.querySelectorAll('button');

      prevBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        if (currentIndex > 0) {
          currentIndex--;
          renderImage(); 
        }
      });
      
      nextBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        if (currentIndex < images.length - 1) {
          currentIndex++;
          renderImage(); 
        }
      });
      
      closeBtn.addEventListener('click', () => modal.remove());
    }

    renderImage();
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove(); // click outside to close
    });

    // Add keyboard navigation
    const handleKeydown = (e) => {
      if (e.key === 'Escape') modal.remove();
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        currentIndex--;
        renderImage();
      }
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        currentIndex++;
        renderImage();
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
    modal._cleanup = () => document.removeEventListener('keydown', handleKeydown);

    document.body.appendChild(modal);
  }

  // ===================================
  // EVENT LISTENERS
  // ===================================
  function attachEventListeners() {
    feederTilesContainer.addEventListener("click", (e) => {
      const tile = e.target.closest(".feeder-tile");
      if (!tile) return;
      const feederId = parseInt(tile.dataset.feederId);
      if (feederId) showBarangayView(feederId);
    });

    backBtn.addEventListener("click", () => {
      if (currentView === 'individuals') showBarangayView(currentFeederId);
      else if (currentView === 'barangays') showFeederTilesView();
    });

    // --- NEW EVENT LISTENER FOR ANNOUNCEMENT BUTTON ---
    // Opens the unified modal without selecting specific reports (empty array)
    if(createAnnouncementBtn) {
        createAnnouncementBtn.addEventListener("click", () => {
          window.showUpdateModal([], 'reports', {
              currentView: currentView,
              currentFeederId: currentFeederId,
              currentBarangay: currentBarangay,
              manualCreation: true 
          });
        });
    }

    // --- NEW LISTENER FOR ATTACH BUTTON ---
    if(attachToAnnouncementBtn) {
        attachToAnnouncementBtn.addEventListener("click", () => {
            if(selectedItems.size === 0) {
                // Better UI feedback
                alert("Please select at least one pending report to attach.");
                return;
            }
            if(!currentFeederId) {
                alert("Please select a feeder first.");
                return;
            }
            showAttachModal(currentFeederId);
        });
    }

    // Updated bulk update to use unified modal system
    bulkUpdateBtn.addEventListener('click', () => {
      if (selectedItems.size === 0) return;
      window.showUpdateModal(Array.from(selectedItems), 'reports', {
        currentView: currentView,
        currentFeederId: currentFeederId,
        currentBarangay: currentBarangay
      });
    });

    // Event delegation for table buttons
    reportsBody.addEventListener('click', (e) => {
      const target = e.target;
      const btn = target.closest('button'); 
      if (!btn) return;

      const id = btn.dataset.id; // Get id from the button

      if (btn.classList.contains('copy-coords-btn')) {
          handleCopyCoords(e);
          return;
      }
      
      if (btn.classList.contains('copy-contact-btn')) {
          handleCopyContact(e);
          return;
      }

      if (currentView === 'barangays') {
        if (btn.classList.contains('view-barangay-btn')) {
          showIndividualView(id);
        } else if (btn.classList.contains('update-item-btn')) {
          selectedItems.clear(); 
          selectedItems.add(id); 
          window.showUpdateModal([id], 'reports', {
            currentView: currentView,
            currentFeederId: currentFeederId,
            currentBarangay: currentBarangay
          });
        }
      } else if (currentView === 'individuals') {
        if (btn.classList.contains('update-item-btn')) {
          selectedItems.clear(); 
          selectedItems.add(id); 
          window.showUpdateModal([id], 'reports', {
            currentView: currentView,
            currentFeederId: currentFeederId,
            currentBarangay: currentBarangay
          });
        } else if (btn.classList.contains('view-details-btn')) {
          showIndividualDetails(id);
        } else if (btn.classList.contains('view-images-btn')) {
          try {
            const images = JSON.parse(btn.dataset.images);
            if (images && images.length > 0) {
              showImageModal(images, 0);
            }
          } catch (error) {
            console.error('Error parsing images:', error);
          }
        }
      }
    });

    reportsBody.addEventListener('change', (e) => {
      if (e.target.classList.contains('report-checkbox')) handleCheckboxChange(e);
    });

    sortFilterEl.addEventListener('change', applyFiltersAndRender);
    searchInputEl.addEventListener('input', applyFiltersAndRender);

    prevPageBtn.addEventListener('click', () => changePage('prev'));
    nextPageBtn.addEventListener('click', () => changePage('next'));

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Refresh with F5
      if (e.key === 'F5') {
        e.preventDefault();
        refreshCurrentView();
      }
      
      // Escape key to go back
      if (e.key === 'Escape') {
        if (currentView === 'individuals') {
          showBarangayView(currentFeederId);
        } else if (currentView === 'barangays') {
          showFeederTilesView();
        }
      }
    });
  }

  // --- Start ---
  init();
});