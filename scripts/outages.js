// ==========================================
// OUTAGES.JS - Fixed (v11 - Multi-Image Gallery)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Outages Page Script Loaded (v11 - Gallery Fix)");

  // --- Global State ---
  let allOutages = [];
  let selectedFeeders = new Set(); 

  // --- Elements ---
  const originalContainer = document.getElementById("outagesContainer");
  const statusFilter = document.getElementById("statusFilter");
  const locationSearch = document.getElementById("locationSearch");
  const feederButtonContainer = document.getElementById("feederButtonContainer");

  // --- Config ---
  window.STATUS_COLORS = {
    Reported: { text: "text-red-600", bg: "bg-red-50", border: "border-red-100", icon: "report" },
    Ongoing: { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", icon: "engineering" },
    Completed: { text: "text-green-600", bg: "bg-green-50", border: "border-green-100", icon: "check_circle" },
    Default: { text: "text-gray-600", bg: "bg-gray-50", border: "border-gray-100", icon: "help" }
  };

  // --- Init ---
  init();

  async function init() {
    if (!window.supabase) {
        if(originalContainer) originalContainer.innerHTML = '<p class="text-red-500">Error: Supabase not connected</p>';
        return;
    }

    setupLayoutStructure();
    generateFeederFilterButtons(); 
    setupEventDelegation(); 
    
    await fetchOutages();          
    
    window.addEventListener('outages-updated', () => {
        console.log("Global update detected, refreshing data...");
        fetchOutages();
    });

    window.applyFilters = renderOutages; 
    if(statusFilter) statusFilter.addEventListener("change", renderOutages);
    if(locationSearch) locationSearch.addEventListener("input", renderOutages);
  }

  // ===================================
  // 1. LAYOUT STRUCTURE
  // ===================================
  function setupLayoutStructure() {
      if (document.getElementById('layoutWrapper')) return; 

      const wrapper = document.createElement('div');
      wrapper.id = 'layoutWrapper';
      wrapper.className = 'grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-0'; 

      originalContainer.parentNode.insertBefore(wrapper, originalContainer);

      originalContainer.className = 'lg:col-span-8 space-y-6'; 
      wrapper.appendChild(originalContainer);

      const sidebar = document.createElement('div');
      sidebar.id = 'analyticsSidebar';
      sidebar.className = 'lg:col-span-4 space-y-6 sticky top-4 z-10'; 
      wrapper.appendChild(sidebar);
  }

  // ===================================
  // 2. DATA FETCHING
  // ===================================
  async function fetchOutages() {
    try {
        if(originalContainer.innerHTML === "") {
             originalContainer.innerHTML = '<div class="p-10 text-center text-gray-400">Loading outages...</div>';
        }

        const { data, error } = await supabase
            .from('announcements')
            .select(`*, announcement_images ( image_url )`);

        if (error) throw error;

        allOutages = data.map(item => {
             const newImgs = item.announcement_images ? item.announcement_images.map(i => i.image_url) : [];
             const oldImgs = Array.isArray(item.pictures) ? item.pictures : [];
             return { ...item, images: [...new Set([...newImgs, ...oldImgs])] };
        }) || [];

        // Sort: Newest Updated/Created first
        allOutages.sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at);
            const dateB = new Date(b.updated_at || b.created_at);
            return dateB - dateA; 
        });

        renderOutages();

    } catch (err) {
        console.error("Error fetching outages:", err);
    }
  }

  // ===================================
  // 3. SIDEBAR ANALYTICS
  // ===================================
  function renderAnalytics(filteredData) {
      const sidebar = document.getElementById('analyticsSidebar');
      if(!sidebar) return;

      const activeOutages = filteredData.filter(i => i.status === 'Reported' || i.status === 'Ongoing');
      const activeCount = activeOutages.length;
      
      const feederCounts = {};
      filteredData.forEach(i => { if(i.feeder_id) feederCounts[i.feeder_id] = (feederCounts[i.feeder_id]||0)+1; });
      const topFeeder = Object.keys(feederCounts).sort((a,b) => feederCounts[b] - feederCounts[a])[0] || 'None';

      const areaCounts = {};
      filteredData.forEach(item => {
          if (item.areas_affected && item.areas_affected.length > 0) {
              item.areas_affected.forEach(area => areaCounts[area] = (areaCounts[area]||0) + 1);
          } else if (item.location) {
              areaCounts[item.location] = (areaCounts[item.location]||0) + 1;
          }
      });
      const topArea = Object.keys(areaCounts).sort((a,b) => areaCounts[b] - areaCounts[a])[0] || 'N/A';

      let longestOutage = null;
      let maxDuration = 0;
      const now = new Date();
      activeOutages.forEach(item => {
          const duration = now - new Date(item.created_at);
          if (duration > maxDuration) {
              maxDuration = duration;
              longestOutage = item;
          }
      });
      
      let criticalTimeText = '';
      if (longestOutage) {
          const hours = Math.floor(maxDuration / (1000 * 60 * 60));
          criticalTimeText = `${hours} hours`;
      }

      sidebar.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500">System Status</h4>
                    <p class="text-4xl font-black text-gray-800 dark:text-white mt-2">${activeCount}</p>
                    <p class="text-sm text-gray-500">Active Incidents</p>
                </div>
                <div class="text-right">
                    <span class="h-3 w-3 rounded-full ${activeCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'} inline-block"></span>
                    <p class="text-xl font-bold text-gray-800 dark:text-white mt-3">F-${topFeeder}</p>
                    <p class="text-xs text-gray-500">Top Feeder</p>
                </div>
            </div>
        </div>

        ${longestOutage ? `
        <div class="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 shadow-sm border border-red-100 dark:border-red-800/50 relative overflow-hidden">
            <div class="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                <span class="material-icons text-sm">priority_high</span>
                <h4 class="text-xs font-bold uppercase tracking-wider">Attention Needed</h4>
            </div>
            <p class="font-bold text-gray-800 dark:text-white line-clamp-1">${longestOutage.location}</p>
            <div class="flex items-center gap-2 mt-2">
                <span class="text-3xl font-black text-red-600 dark:text-red-400">${criticalTimeText}</span>
                <span class="text-xs text-red-400 font-medium">unresolved</span>
            </div>
            <button class="mt-4 text-xs font-bold text-red-600 hover:underline view-critical-btn" data-id="${longestOutage.id}">View Incident &rarr;</button>
            <span class="material-icons absolute -right-4 -bottom-4 text-[6rem] text-red-500 opacity-5">timer</span>
        </div>` : ''}

        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Hotspot Area</h4>
            <div class="flex items-center gap-3">
                <span class="material-icons text-orange-500">place</span>
                <div>
                    <p class="font-bold text-gray-800 dark:text-white text-lg">${topArea}</p>
                    <p class="text-xs text-gray-400">Most active reports</p>
                </div>
            </div>
        </div>
        
        <div class="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-800/30">
            <h4 class="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">Suggestion</h4>
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                ${activeCount > 0 ? `Focus dispatch teams on <strong>${topArea}</strong> (Feeder ${topFeeder}) to maximize restoration impact.` : 'Grid status is nominal.'}
            </p>
        </div>
      `;

      const critBtn = sidebar.querySelector('.view-critical-btn');
      if(critBtn) critBtn.addEventListener('click', () => window.showUpdateModal([critBtn.dataset.id], 'outages'));
  }

  // ===================================
  // 4. MAIN FEED RENDER
  // ===================================
  function renderOutages() {
    if(!originalContainer) return;
    originalContainer.innerHTML = "";
    
    const searchTerm = locationSearch ? locationSearch.value.toLowerCase() : '';
    const statusTerm = statusFilter ? statusFilter.value : 'all';
    
    const filtered = allOutages.filter(item => {
        if (statusTerm !== 'all' && item.status !== statusTerm) return false;
        if (selectedFeeders.size > 0 && (!item.feeder_id || !selectedFeeders.has(parseInt(item.feeder_id)))) return false;
        const textMatch = (
            (item.location && item.location.toLowerCase().includes(searchTerm)) ||
            (item.cause && item.cause.toLowerCase().includes(searchTerm))
        );
        return !searchTerm || textMatch;
    });

    renderAnalytics(filtered);

    if (filtered.length === 0) {
        originalContainer.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-dashed border-gray-300 dark:border-gray-700">
                <span class="material-icons text-4xl text-gray-300 mb-2">feed</span>
                <p class="text-gray-500 font-medium">No active posts.</p>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach(item => {
        const config = window.STATUS_COLORS[item.status] || window.STATUS_COLORS.Default;
        const displayDate = new Date(item.updated_at || item.created_at);
        const dateStr = displayDate.toLocaleString('en-US', { weekday: 'short', month:'short', day:'numeric', hour: 'numeric', minute:'numeric', hour12: true });
        const isEdited = item.updated_at && (new Date(item.updated_at) > new Date(item.created_at));

        const headerTitle = `
            <span class="font-bold text-gray-900 dark:text-white text-lg">${item.cause || 'Outage'}</span> 
            <span class="text-gray-400 font-normal mx-1 text-sm">at</span> 
            <span class="font-bold text-gray-900 dark:text-white text-lg">${item.location || 'Unknown Area'}</span>
        `;

        let imagesHtml = '';
        if (item.images && item.images.length > 0) {
            imagesHtml = `
                <div class="w-full mt-4 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 relative group-image cursor-pointer view-image-trigger">
                    <img src="${item.images[0]}" class="w-full h-auto max-h-[500px] object-contain bg-gray-50 dark:bg-gray-800">
                    ${item.images.length > 1 ? 
                        `<div class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg font-bold backdrop-blur-sm pointer-events-none">
                            +${item.images.length - 1} photos
                        </div>` : ''}
                </div>
            `;
        }

        html += `
        <div id="report-${item.id}" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer outage-card-trigger" data-id="${item.id}">
            
            <div class="p-5 pb-2 flex justify-between items-start">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-full ${config.bg} ${config.text} flex items-center justify-center shrink-0 mt-1">
                        <span class="material-icons text-xl">${config.icon}</span>
                    </div>
                    <div>
                        <h3 class="leading-tight">${headerTitle}</h3>
                        <div class="flex items-center gap-2 mt-1">
                             <span class="text-xs font-bold uppercase tracking-wide ${config.text}">${item.status}</span>
                             <span class="text-gray-300">•</span>
                             <p class="text-sm text-gray-500 dark:text-gray-400">
                                ${dateStr} 
                                ${isEdited ? '<span class="text-xs italic text-gray-400 ml-1">(edited)</span>' : ''}
                             </p>
                        </div>
                    </div>
                </div>

                ${item.feeder_id ? `
                <div class="text-right pl-4">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">FEEDER</span>
                    <span class="text-3xl font-black text-gray-300 dark:text-gray-600 leading-none">0${item.feeder_id}</span>
                </div>` : ''}
            </div>

            <div class="px-5 pb-2">
                ${item.description ? `<p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mt-2">${item.description}</p>` : ''}
                ${imagesHtml}
            </div>

            <div class="px-5 py-3 bg-gray-50 dark:bg-gray-900/30 border-t dark:border-gray-700 flex gap-3 mt-2">
                <button class="flex-1 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 transition outage-card-trigger" data-id="${item.id}">
                    View Details
                </button>
                <button class="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition update-btn" data-id="${item.id}">
                    Manage
                </button>
            </div>
        </div>
        `;
    });
    
    originalContainer.innerHTML = html;
    handleDeepLink();
}

  // ===================================
  // 5. EVENTS & MODALS
  // ===================================
  function setupEventDelegation() {
    if (!originalContainer) return;

    originalContainer.addEventListener('click', (e) => {
        const target = e.target;

        // Update
        const updateBtn = target.closest('.update-btn');
        if (updateBtn) {
            e.stopPropagation();
            e.preventDefault();
            window.showUpdateModal([updateBtn.dataset.id], 'outages');
            return;
        }

        // Image Gallery Trigger
        const imgTrigger = target.closest('.view-image-trigger');
        if (imgTrigger) {
            e.stopPropagation();
            
            // FIX: Find the outage object to get ALL images, not just the cover
            const card = imgTrigger.closest('.outage-card-trigger');
            if (card) {
                const id = parseInt(card.dataset.id);
                const item = allOutages.find(i => i.id === id);
                if (item && item.images && item.images.length > 0) {
                    showImageGallery(item.images);
                }
            }
            return;
        }

        // Details
        const card = target.closest('.outage-card-trigger');
        if (card) {
            if (window.getSelection().toString().length > 0) return;
            showDetailsModal(parseInt(card.dataset.id));
        }
    });
  }

  // FIX: Converted to Gallery Mode (Scrollable)
  function showImageGallery(images) {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[9999] p-4';
      
      const imagesHtml = images.map(url => `
        <div class="mb-6 last:mb-0">
            <img src="${url}" class="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl bg-gray-900 mx-auto">
        </div>
      `).join('');

      modal.innerHTML = `
        <div class="relative w-full max-w-4xl max-h-full flex flex-col">
            <button class="absolute -top-10 right-0 text-white/70 hover:text-white z-50 p-2 close-gallery">
                <span class="material-icons text-3xl">close</span>
            </button>
            
            <div class="overflow-y-auto max-h-[90vh] pr-2 space-y-4 custom-scrollbar">
                ${imagesHtml}
            </div>
        </div>
      `;

      // Close on backdrop or button
      modal.addEventListener('click', (e) => {
          if (e.target === modal || e.target.closest('.close-gallery')) {
              modal.remove();
          }
      });
      
      document.body.appendChild(modal);
  }

  function showDetailsModal(outageId) {
    const outage = allOutages.find(o => o.id === outageId);
    if (!outage) return;

    const config = window.STATUS_COLORS[outage.status] || window.STATUS_COLORS.Default;
    
    let areasHtml = '<span class="text-gray-400 italic">No specific areas listed</span>';
    if (outage.areas_affected && outage.areas_affected.length > 0) {
        areasHtml = outage.areas_affected.map(area => `<span class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">${area}</span>`).join('');
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4';
    
    modal.dataset.modalId = outageId;

    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        
        <div class="p-6 border-b dark:border-gray-700 flex justify-between items-start">
           <div class="flex gap-4">
               <div class="w-12 h-12 rounded-full ${config.bg} ${config.text} flex items-center justify-center">
                   <span class="material-icons text-2xl">${config.icon}</span>
               </div>
               <div>
                   <h2 class="text-xl font-bold text-gray-900 dark:text-white leading-tight">${outage.cause || 'Outage'}</h2>
                   <p class="text-sm text-gray-500">at ${outage.location}</p>
               </div>
           </div>
           <button class="close-modal w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><span class="material-icons">close</span></button>
        </div>

        <div class="p-6 overflow-y-auto space-y-6">
           <div class="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
               <div>
                   <p class="text-xs text-gray-400 uppercase font-bold">Status</p>
                   <p class="font-medium ${config.text}">${outage.status}</p>
               </div>
               <div>
                   <p class="text-xs text-gray-400 uppercase font-bold">Type</p>
                   <p class="font-medium text-gray-700 dark:text-gray-300">${outage.type}</p>
               </div>
               <div>
                   <p class="text-xs text-gray-400 uppercase font-bold">ETA</p>
                   <p class="font-medium text-blue-600">${outage.estimated_restoration_at ? new Date(outage.estimated_restoration_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'TBD'}</p>
               </div>
           </div>

           <div>
               <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-2">Description</h4>
               <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">${outage.description || 'No description.'}</p>
           </div>

           <div>
               <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-2">Affected Areas</h4>
               <div class="flex flex-wrap gap-2">${areasHtml}</div>
           </div>

           ${outage.images && outage.images.length > 0 ? `
           <div>
               <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-2">Images</h4>
               <div class="grid grid-cols-2 gap-2">
                  ${outage.images.map(url => `<img src="${url}" class="w-full h-auto max-h-64 object-contain bg-gray-50 rounded-lg border cursor-pointer hover:opacity-90" onclick="window.open('${url}')">`).join('')}
               </div>
           </div>` : ''}
        </div>
        
        <div class="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex justify-end gap-3">
             <button class="close-modal px-4 py-2 rounded-lg text-gray-500 font-bold hover:bg-gray-200 transition">Close</button>
             <button class="update-from-modal px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition">Update Status</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => modal.remove()));
    
    modal.querySelector('.update-from-modal').onclick = () => {
        modal.remove();
        setTimeout(() => {
            window.showUpdateModal([outageId], 'outages');
        }, 50);
    };
  }

  // ===================================
  // 6. FILTERS
  // ===================================
  function generateFeederFilterButtons() {
    if(!feederButtonContainer) return;
    feederButtonContainer.innerHTML = '';
    for (let i = 1; i <= 14; i++) {
        const btn = document.createElement("button");
        btn.className = "feeder-toggle px-3 py-2 text-xs font-bold rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-600 hover:text-blue-600 transition border border-gray-200 dark:border-gray-600";
        btn.textContent = `F-${i}`;
        btn.addEventListener("click", (e) => {
             e.stopPropagation(); 
             const isActive = btn.classList.contains("bg-blue-600");
             if(isActive) {
                 btn.className = "feeder-toggle px-3 py-2 text-xs font-bold rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-600 hover:text-blue-600 transition border border-gray-200 dark:border-gray-600";
                 selectedFeeders.delete(i);
             } else {
                 btn.className = "feeder-toggle px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white border-blue-600 shadow-md transform scale-105 transition";
                 selectedFeeders.add(i);
             }
             renderOutages();
        });
        feederButtonContainer.appendChild(btn);
    }
    
    const clearBtn = document.getElementById('feederClearAll');
    if(clearBtn) clearBtn.addEventListener('click', () => {
        selectedFeeders.clear();
        document.querySelectorAll('.feeder-toggle').forEach(b => b.className = "feeder-toggle px-3 py-2 text-xs font-bold rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-600 hover:text-blue-600 transition border border-gray-200 dark:border-gray-600");
        renderOutages();
    });

    const selectAllBtn = document.getElementById('feederSelectAll');
    if(selectAllBtn) selectAllBtn.addEventListener('click', () => {
        for(let i=1; i<=14; i++) selectedFeeders.add(i);
        document.querySelectorAll('.feeder-toggle').forEach(b => b.className = "feeder-toggle px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white border-blue-600 shadow-md transform scale-105 transition");
        renderOutages();
    });
  }
});

// ==========================================
// 7. DEEP LINK (DOUBLE-TAP FIX)
// ==========================================
function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id');
    
    if (targetId) {
        const el = document.getElementById(`report-${targetId}`);
        if (el) {
            // STEP 1: Instant Jump (Best Guess)
            // We use 'center' to avoid the sticky header covering the top
            el.scrollIntoView({ behavior: "auto", block: "center" });
            
            // Highlight ON
            el.classList.add('ring-4', 'ring-yellow-400');
            
            // STEP 2: The Correction (Crucial Fix)
            // We force a second jump after 400ms. 
            // This catches the post if images loaded and pushed it down.
            setTimeout(() => {
                el.scrollIntoView({ behavior: "auto", block: "center" });
            }, 400);

            // Highlight OFF
            setTimeout(() => el.classList.remove('ring-4', 'ring-yellow-400'), 2500);
        }
    }
}