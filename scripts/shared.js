// ==========================
// SHARED SCRIPT (v13 - Report IDs & Status Sync Fixed)
// ==========================
// Loaded SECOND on every page

// --- GLOBAL UTILITY FUNCTIONS ---

/**
 * Shows a temporary success popup.
 * @param {string} message The message to display.
 */
window.showSuccessPopup = function(message) {
const popup = document.createElement('div');
popup.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-[9999] transform transition-transform duration-300 translate-x-0';
popup.innerHTML = `
  <div class="flex items-center space-x-3">
    <span class="material-icons text-white">check_circle</span>
    <span class="font-medium">${message}</span>
    <button class="text-white hover:text-green-100 close-popup ml-2">
      <span class="material-icons text-sm">close</span>
    </button>
  </div>
`;
document.body.appendChild(popup);
setTimeout(() => {
  if (popup.parentNode) {
    popup.style.transform = 'translateX(100%)';
    setTimeout(() => popup.remove(), 300);
  }
}, 4000);
popup.querySelector('.close-popup').addEventListener('click', () => {
  popup.style.transform = 'translateX(100%)';
  setTimeout(() => popup.remove(), 300);
});
}

/**
 * Shows a temporary error popup.
 * @param {string} message The error message to display.
 */
window.showErrorPopup = function(message) {
const popup = document.createElement('div');
popup.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-[9999] transform transition-transform duration-300 translate-x-0';
popup.innerHTML = `
  <div class="flex items-center space-x-3">
    <span class="material-icons text-white">error</span>
    <span class="font-medium">${message}</span>
    <button class="text-white hover:text-red-100 close-popup ml-2">
      <span class="material-icons text-sm">close</span>
    </button>
  </div>
`;
document.body.appendChild(popup);
setTimeout(() => {
  if (popup.parentNode) {
    popup.style.transform = 'translateX(100%)';
    setTimeout(() => popup.remove(), 300);
  }
}, 4000);
popup.querySelector('.close-popup').addEventListener('click', () => {
  popup.style.transform = 'translateX(100%)';
  setTimeout(() => popup.remove(), 300);
});
}

/**
 * Sets up toggle and click-outside-to-close logic for a dropdown.
 * @param {string} buttonId The ID of the trigger button.
 * @param {string} popupId The ID of the popup/dropdown element.
 */
window.setupDropdownToggle = function(buttonId, popupId) {
const button = document.getElementById(buttonId);
const popup = document.getElementById(popupId);
if (!button || !popup) return;
button.addEventListener("click", (e) => {
  e.stopPropagation();
  popup.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!popup.contains(e.target) && !button.contains(e.target)) {
    popup.classList.add("hidden");
  }
});
};

// ==========================
// UNIFIED MODAL SYSTEM FOR REPORTS & OUTAGES (v6)
// ==========================

/**
 * Unified function to show update modal for both Reports and Outages
 * @param {Array} itemIds - Array of item IDs to update
 * @param {string} context - 'reports' or 'outages'
 * @param {Object} options - Additional options like currentFeederId, currentBarangay, manualCreation
 */
window.showUpdateModal = async function(itemIds, context, options = {}) {
  
if ((!Array.isArray(itemIds) || itemIds.length === 0) && !options.manualCreation) {
  console.error('No item IDs provided to showUpdateModal');
  return;
}

const isBulk = itemIds.length > 1;
const dispatchTeams = [
  { id: 'alpha', name: 'Team Alpha' },
  { id: 'beta', name: 'Team Beta' },
  { id: 'gamma', name: 'Team Gamma' }
];

try {
  let itemsData = [];
  let allAssociatedIds = [];
  let feederId = options.currentFeederId || null;
  let selectedBarangays = new Set();
  
  // Data Fetching Logic (Untouched)
  if (context === 'reports') {
    const pendingItems = window.getPendingItems ? window.getPendingItems() : [];
    if (options.currentView === 'barangays') {
      itemsData = itemIds.map(barangayName => ({ barangay: barangayName }));
      selectedBarangays = new Set(itemIds);
      const barangayReports = pendingItems.filter(r => itemIds.includes(r.barangay));
      if (barangayReports.length > 0 && !feederId) feederId = barangayReports[0].feeder;
      allAssociatedIds = barangayReports.map(r => r.id);
    } else {
      itemsData = pendingItems.filter(r => itemIds.includes(r.id));
      allAssociatedIds = itemIds;
      itemsData.forEach(item => {
        if (item.barangay) selectedBarangays.add(item.barangay);
        if (!feederId && item.feeder) feederId = item.feeder;
      });
    }
  } else if (context === 'outages') {
    if (!window.supabase) return;
    if (itemIds.length > 0) {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, announcement_images ( id, image_url )') 
        .in('id', itemIds);

      if (!error) {
        itemsData = data.map(item => {
          const newImageUrls = item.announcement_images ? item.announcement_images.map(img => img.image_url) : [];
          const oldImageUrls = Array.isArray(item.pictures) ? item.pictures : [];
          const singleImageUrl = item.picture ? [item.picture] : [];
          return {
            ...item,
            images: [...new Set([...newImageUrls, ...oldImageUrls, ...singleImageUrl])]
          };
        });
      }
    }
    allAssociatedIds = itemIds;
    itemsData.forEach(item => {
      if (item.areas_affected) item.areas_affected.forEach(a => selectedBarangays.add(a));
      if (!feederId && item.feeder_id) feederId = item.feeder_id;
    });
  }

  const initialData = itemsData[0] || {};
  if (context === 'reports') initialData.images = []; 

  // Feeder/Barangay Logic (Untouched)
  let allBarangaysInFeeder = [];
  if (feederId && window.supabase) {
    const { data: feederBarangays } = await supabase.from('feeder_barangays').select(`barangay_id, barangays ( id, name )`).eq('feeder_id', parseInt(feederId));
    if (feederBarangays) allBarangaysInFeeder = feederBarangays.map(fb => fb.barangays?.name).filter(Boolean).sort();
  }
  if (allBarangaysInFeeder.length === 0 && selectedBarangays.size > 0) {
    allBarangaysInFeeder = Array.from(selectedBarangays).sort();
  }

  // Modal HTML Construction
  let areaInfoHTML = allBarangaysInFeeder.length > 0 ? `Feeder ${feederId || 'N/A'} - ${allBarangaysInFeeder.length} barangays` : 'No barangays configured';
  let areaButtonsHTML = allBarangaysInFeeder.length > 0 
    ? allBarangaysInFeeder.map(barangay => {
        const isSelected = selectedBarangays.has(barangay); 
        return `<button type="button" class="area-toggle-btn px-3 py-1.5 rounded-full text-sm font-medium transition ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}" data-barangay="${barangay}">${barangay}</button>`;
      }).join('')
    : `<div class="text-center p-4"><p class="text-red-500 text-sm mb-2">No barangays found</p></div>`;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4';
  modal.id = 'updateModal';
  
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
          ${isBulk ? 'Bulk Update / Announce' : 'Update ' + (context === 'reports' ? 'Report' : 'Outage') + ' / Announce'}
        </h3>
        <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 close-modal"><span class="material-icons">close</span></button>
      </div>
      <form id="updateForm" class="p-6 space-y-4 overflow-y-auto">
        ${feederId ? `<div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg"><label class="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Feeder Group</label><p class="text-lg font-semibold text-blue-600 dark:text-blue-400">Feeder ${feederId}</p></div>` : ''}
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Outage Type</label>
          <div class="flex space-x-4">
            <label class="inline-flex items-center cursor-pointer"><input type="radio" name="outageType" value="scheduled" class="form-radio text-blue-600" ${initialData.type === 'scheduled' ? 'checked' : ''}><span class="ml-2 text-gray-700 dark:text-gray-300">Scheduled</span></label>
            <label class="inline-flex items-center cursor-pointer"><input type="radio" name="outageType" value="unscheduled" class="form-radio text-blue-600" ${initialData.type !== 'scheduled' ? 'checked' : true}><span class="ml-2 text-gray-700 dark:text-gray-300">Unscheduled</span></label>
          </div>
        </div>
        <div id="scheduledDateContainer" class="hidden transition-all duration-300">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scheduled Date</label>
          <input type="datetime-local" id="scheduledAtInput" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" value="${initialData.scheduled_at ? new Date(initialData.scheduled_at).toISOString().slice(0, 16) : ''}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cause</label>
          <input type="text" id="causeInput" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" value="${initialData.cause || ''}" placeholder="Enter cause">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
          <input type="text" id="locationInput" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" value="${initialData.location || ''}" placeholder="Ex: Purok 5">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Pictures</label>
          <input type="file" id="modalFileInput" multiple accept="image/*" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200">
          <div id="imagePreview" class="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2 ${initialData.images?.length ? '' : 'hidden'}"></div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Affected Areas <span class="text-blue-600 dark:text-blue-400">(${areaInfoHTML})</span></label>
          ${allBarangaysInFeeder.length > 0 ? `<div class="flex items-center mb-3"><input type="checkbox" id="selectAllBarangays" class="h-4 w-4 text-blue-600"><label for="selectAllBarangays" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Select All</label></div>` : ''}
          <div id="areasButtonContainer" class="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 min-h-[40px] max-h-32 overflow-y-auto">${areaButtonsHTML}</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
          <select id="statusSelect" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
            <option value="Reported" ${initialData.status === 'Reported' ? 'selected' : (context === 'reports' ? 'selected' : '')}>Reported</option>
            <option value="Ongoing" ${initialData.status === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
            <option value="Completed" ${initialData.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
        <div id="dispatchTeamSection" class="${initialData.status === 'Ongoing' ? '' : 'hidden'}">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dispatch Team</label>
          <select id="dispatchTeamSelect" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
            <option value="">None</option>
            ${dispatchTeams.map(team => `<option value="${team.id}" ${initialData.dispatch_team === team.id ? 'selected' : ''}>${team.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
          <textarea id="modalDescription" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" rows="3">${initialData.description || ''}</textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ETA</label>
          <input type="datetime-local" id="modalEta" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" value="${initialData.estimated_restoration_at ? new Date(initialData.estimated_restoration_at).toISOString().slice(0, 16) : ''}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Map Coordinates</label>
          <div class="flex items-center space-x-2 mb-2">
            <input type="checkbox" id="enableCoordinates" class="h-4 w-4 text-blue-600 border-gray-300 rounded">
            <label for="enableCoordinates" class="text-sm text-gray-700 dark:text-gray-300">Specify custom location</label>
          </div>
          <input type="text" id="coordinateInput" placeholder="e.g., 16.414102, 120.595055" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 hidden">
        </div>
      </form>
      <div class="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button type="submit" form="updateForm" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition" id="modalUpdateBtn" ${initialData.status === 'Completed' && context === 'outages' ? 'disabled style="background-color: #d1d5db; color: #6b7280; cursor: not-allowed;"' : ''}>
          ${isBulk ? 'Post Bulk Announcement' : 'Update Announcement'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Event Listeners for UI Logic
  modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => modal.remove()));
  
  // Scheduled Type Toggle
  const toggleScheduledInput = () => {
    const selected = modal.querySelector('input[name="outageType"]:checked').value;
    modal.querySelector('#scheduledDateContainer').classList.toggle('hidden', selected !== 'scheduled');
  };
  toggleScheduledInput();
  modal.querySelectorAll('input[name="outageType"]').forEach(radio => radio.addEventListener('change', toggleScheduledInput));

  // Coordinates Toggle
  const enableCoordinates = modal.querySelector('#enableCoordinates');
  const coordinateInput = modal.querySelector('#coordinateInput');
  if (initialData.latitude && initialData.longitude) {
    enableCoordinates.checked = true;
    coordinateInput.classList.remove('hidden');
    coordinateInput.value = `${initialData.latitude}, ${initialData.longitude}`;
  }
  enableCoordinates.addEventListener('change', () => coordinateInput.classList.toggle('hidden', !enableCoordinates.checked));

  // Area Selection Logic
  const areaButtons = modal.querySelectorAll('.area-toggle-btn');
  const selectAllCheckbox = modal.querySelector('#selectAllBarangays');
  let selectedAreas = new Set(selectedBarangays);

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      const isChecked = selectAllCheckbox.checked;
      areaButtons.forEach(btn => {
        const barangay = btn.dataset.barangay;
        isChecked ? selectedAreas.add(barangay) : selectedAreas.delete(barangay);
        btn.classList.toggle('bg-blue-600', isChecked);
        btn.classList.toggle('text-white', isChecked);
        btn.classList.toggle('bg-gray-200', !isChecked);
        btn.classList.toggle('text-gray-800', !isChecked);
      });
    });
  }
  
  areaButtons.forEach(btn => {
    const barangay = btn.dataset.barangay;
    if (selectedAreas.has(barangay)) {
       btn.classList.add('bg-blue-600', 'text-white');
       btn.classList.remove('bg-gray-200', 'text-gray-800');
    }
    btn.addEventListener('click', () => {
      if (selectedAreas.has(barangay)) {
        selectedAreas.delete(barangay);
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-800');
      } else {
        selectedAreas.add(barangay);
        btn.classList.add('bg-blue-600', 'text-white');
        btn.classList.remove('bg-gray-200', 'text-gray-800');
      }
    });
  });

  // Status/Dispatch Toggle
  const statusSelect = modal.querySelector('#statusSelect');
  const dispatchSection = modal.querySelector('#dispatchTeamSection');
  statusSelect.addEventListener('change', () => dispatchSection.classList.toggle('hidden', statusSelect.value !== 'Ongoing'));

  // --- FIXED IMAGE UPLOAD LOGIC ---
  let stagedFiles = [];
  let keptExistingImages = (initialData.images || []);
  const fileInput = modal.querySelector('#modalFileInput');
  const imagePreview = modal.querySelector('#imagePreview');

  const renderPreviews = () => {
      imagePreview.innerHTML = '';
      imagePreview.classList.toggle('hidden', keptExistingImages.length === 0 && stagedFiles.length === 0);

      // Render Existing
      keptExistingImages.forEach((url, index) => {
          const div = document.createElement('div');
          div.className = 'relative group w-full h-16';
          div.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded border border-gray-300"><button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 remove-existing" data-index="${index}">×</button>`;
          imagePreview.appendChild(div);
      });

      // Render Staged
      stagedFiles.forEach((file, index) => {
          const div = document.createElement('div');
          div.className = 'relative group w-full h-16';
          const reader = new FileReader();
          reader.onload = (e) => div.querySelector('img').src = e.target.result;
          reader.readAsDataURL(file);
          div.innerHTML = `<img src="" class="w-full h-full object-cover rounded border border-blue-300"><button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 remove-staged" data-index="${index}">×</button>`;
          imagePreview.appendChild(div);
      });

      // Re-attach listeners
      modal.querySelectorAll('.remove-existing').forEach(b => b.addEventListener('click', (e) => {
          keptExistingImages.splice(e.target.dataset.index, 1);
          renderPreviews();
      }));
      modal.querySelectorAll('.remove-staged').forEach(b => b.addEventListener('click', (e) => {
          stagedFiles.splice(e.target.dataset.index, 1);
          renderPreviews();
      }));
  };

  fileInput.addEventListener('change', (e) => {
      if (e.target.files) Array.from(e.target.files).forEach(f => stagedFiles.push(f));
      renderPreviews();
      fileInput.value = ''; 
  });
  renderPreviews();

  // --- SUBMIT HANDLER ---
  modal.querySelector('#updateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = modal.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Posting...';

    try {
        const newImageUrls = [];
        
        // FIX: Iterate over stagedFiles, NOT the empty file input
        if (stagedFiles.length > 0) {
            console.log(`Uploading ${stagedFiles.length} images...`);
            for (const file of stagedFiles) {
                const fileName = `public/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; // Sanitize filename
                const { data, error } = await supabase.storage.from('announcement_images').upload(fileName, file);
                if (error) throw new Error(`Upload failed: ${error.message}`);
                
                const { data: publicUrlData } = supabase.storage.from('announcement_images').getPublicUrl(data.path);
                newImageUrls.push(publicUrlData.publicUrl);
            }
        }

        const allImageUrls = [...keptExistingImages, ...newImageUrls];
        const coordText = coordinateInput.value.trim();
        let latitude = null, longitude = null;
        if (coordText.includes(',')) [latitude, longitude] = coordText.split(',').map(x => parseFloat(x.trim()));

        const formData = {
          outageType: modal.querySelector('input[name="outageType"]:checked').value,
          cause: modal.querySelector('#causeInput').value,
          location: modal.querySelector('#locationInput').value,
          status: modal.querySelector('#statusSelect').value,
          description: modal.querySelector('#modalDescription').value,
          eta: modal.querySelector('#modalEta').value,
          scheduled_at: modal.querySelector('#scheduledAtInput').value, 
          affectedAreas: Array.from(selectedAreas),
          imageUrls: allImageUrls, 
          latitude, longitude    
        };

        if (context === 'reports') await handleReportsUpdate(allAssociatedIds, formData, feederId);
        else if (context === 'outages') await handleOutagesUpdate(allAssociatedIds, formData, feederId);

        modal.remove();

    } catch (error) {
        console.error('Submission Error:', error);
        window.showErrorPopup(error.message);
        submitButton.disabled = false;
        submitButton.textContent = 'Retry';
    }
  });

} catch (error) {
  console.error('Error in showUpdateModal:', error);
  window.showErrorPopup(error.message);
}
};

/**
 * Handle reports update - converts reports to announcements
 * FIXED: Ensures Report IDs are saved and Statuses are updated.
 */
async function handleReportsUpdate(reportIds, formData, feederId) {
  console.log(`🚀 Starting Announcement Creation. Reports to Link: ${reportIds.length}`, reportIds);

  if (!window.supabase) {
    window.showErrorPopup('Database connection failed.');
    return;
  }

  // 1. Prepare Announcement Data
  const announcementData = {
    feeder_id: feederId ? parseInt(feederId) : null,
    type: formData.outageType,
    cause: formData.cause || 'Maintenance', // Default cause if empty
    location: formData.location || null,
    areas_affected: formData.affectedAreas.length > 0 ? formData.affectedAreas : null,
    barangay: formData.affectedAreas.length > 0 ? formData.affectedAreas[0] : null,
    status: formData.status, // e.g., 'Reported', 'Ongoing'
    description: formData.description || null,
    estimated_restoration_at: formData.eta || null,
    scheduled_at: formData.scheduled_at || null, 
    latitude: formData.latitude,
    longitude: formData.longitude,
    created_at: new Date().toISOString(),
    report_ids: reportIds // <--- CRITICAL: Saving the IDs to the announcement
  };

  try {
    // 2. Insert Announcement
    const { data, error } = await supabase
      .from('announcements')
      .insert([announcementData])
      .select()
      .single(); 

    if (error) throw new Error(`Announcement Insert Failed: ${error.message}`);

    const newAnnouncementId = data.id;
    console.log("✅ Announcement created:", newAnnouncementId);

    // 3. Handle Images (Optional)
    if (formData.imageUrls && formData.imageUrls.length > 0) {
      const imageInserts = formData.imageUrls.map(url => ({
        announcement_id: newAnnouncementId,
        image_url: url
      }));
      await supabase.from('announcement_images').insert(imageInserts);
    }

    // 4. CRITICAL: Update the Reports to link them and change status
    // We do this in a separate try-block so even if it fails, the announcement still exists
    if (reportIds.length > 0) {
      console.log(`🔄 Updating ${reportIds.length} reports to status: ${formData.status}`);
      
      const { error: updateError } = await supabase
        .from('reports')
        .update({ 
          status: formData.status
        })
        .in('id', reportIds);

      if (updateError) {
        console.error("❌ Failed to update report statuses:", updateError);
        window.showErrorPopup("Announcement created, but failed to update report statuses.");
      } else {
        console.log("✅ Reports updated successfully.");
      }
    }

    window.showSuccessPopup("Announcement posted and reports linked!");

    // 5. Force UI Refresh
    // This makes the pending reports disappear immediately from the UI
    if (typeof window.refreshCurrentView === 'function') {
      window.refreshCurrentView();
    } else {
      window.location.reload();
    }

  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    window.showErrorPopup(`Operation failed: ${error.message}`);
  }
}
/**
 * Handle outages updates
 */
async function handleOutagesUpdate(outageIds, formData, feederId) {
  console.log(`Updating ${outageIds.length} outages/announcements:`, formData);

  if (!window.supabase) {
      console.error('Supabase client not found.');
      window.showErrorPopup('Database connection failed.');
      return;
  }

  const announcementData = {
      feeder_id: feederId ? parseInt(feederId) : null,
      type: formData.outageType,
      cause: formData.cause || null,
      location: formData.location || null,
      areas_affected: formData.affectedAreas.length > 0 ? formData.affectedAreas : null,
      barangay: formData.affectedAreas.length > 0 ? formData.affectedAreas[0] : null,
      status: formData.status,
      description: formData.description || null,
      estimated_restoration_at: formData.eta || null,
      scheduled_at: formData.scheduled_at || null, 
      latitude: formData.latitude,  
      longitude: formData.longitude, 
      updated_at: new Date().toISOString() 
  };

  try {
      const { data, error } = await supabase
          .from('announcements')
          .update(announcementData)
          .in('id', outageIds);

      if (error) {
          throw error;
      }
      
      const { error: deleteError } = await supabase
          .from('announcement_images')
          .delete()
          .in('announcement_id', outageIds);
      
      if (deleteError) {
          console.error('Error clearing old announcement images:', deleteError);
      }

      if (formData.imageUrls && formData.imageUrls.length > 0) {
          const imageInserts = [];
          for (const id of outageIds) { 
              for (const url of formData.imageUrls) { 
                  imageInserts.push({
                      announcement_id: id,
                      image_url: url
                  });
              }
          }

          if (imageInserts.length > 0) {
              const { error: insertError } = await supabase
                  .from('announcement_images')
                  .insert(imageInserts);
              
              if (insertError) {
                  console.error('Error inserting new announcement images:', insertError);
                  window.showErrorPopup("Outage updated, but failed to save images.");
              }
          }
      }

      window.showSuccessPopup("Outage updated successfully!");

      if (typeof window.applyFiltersAndRender === 'function') {
          window.applyFiltersAndRender();
      }
      if (typeof window.loadAnnouncementsToMap === "function") {
          window.loadAnnouncementsToMap();
      }
  } catch (error) {
      console.error('Error updating announcement:', error.message);
      window.showErrorPopup(`Error updating announcement: ${error.message}`);
  }
}

// =================================================================
// UPDATED PROFILE LOGIC (Correctly ported from Global.js)
// =================================================================

// Staged file for profile picture upload
let stagedAvatarFile = null;

// 1. Sync User Profile (Header & Sidebar)
async function internalSyncUserProfile() {
    if (!window.supabase) return;
    
    // Get the current session
    const { data: { session }, error } = await supabase.auth.getSession();

    const headerName = document.getElementById("adminName");
    const headerImg = document.getElementById("adminProfile");
    const dropdownEmail = document.querySelector("#profileDropdown p.text-gray-500");

    // === AUTH GUARD: REDIRECT IF NOT LOGGED IN ===
    if (error || !session) {
        // Only redirect if we are NOT already on the login page
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace('login.html'); 
            return;
        }

        // If we are on the login page (or Guest mode is allowed), show GUEST
        if (headerName) headerName.textContent = "GUEST";
        return;
    }
    // =============================================

    // If logged in, load profile data
    const user = session.user;
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    const displayName = firstName ? `${firstName} ${lastName}` : user.email.split('@')[0];
    const avatarUrl = profile?.profile_picture || "https://via.placeholder.com/150";

    // Update UI elements
    if (headerName) headerName.textContent = displayName.toUpperCase();
    if (headerImg) headerImg.src = avatarUrl;
    if (dropdownEmail) dropdownEmail.textContent = user.email;
}

// 2. Open Profile Modal (Dynamic)
async function showProfileModal() {
    stagedAvatarFile = null;
    let profile = {};
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.showErrorPopup("Please log in to edit your profile");
            return;
        }

        const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, mobile, profile_picture') 
            .eq('id', user.id)
            .single();

        profile = profileData || {};
        const avatarSrc = profile.profile_picture || 'https://via.placeholder.com/150';

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'profile-modal-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
                <div class="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">Edit Profile</h2>
                    <button id="cancel-profile" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                
                <div class="p-6 max-h-[80vh] overflow-y-auto">
                    <div class="flex flex-col items-center mb-6">
                        <div class="relative group cursor-pointer">
                            <img id="profile-image-circle" src="${avatarSrc}" alt="Profile" 
                                 class="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-600 shadow-md transition-opacity group-hover:opacity-80">
                            <div class="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 bg-black bg-opacity-30">
                                <span class="material-icons text-white">camera_alt</span>
                            </div>
                        </div>
                        <input type="file" id="profile-image-input" accept="image/*" class="hidden">
                        <button id="update-image-btn" type="button" class="mt-2 text-sm text-blue-600 font-medium hover:underline dark:text-blue-400">
                            Change Photo
                        </button>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                            <input type="email" value="${user.email || ''}" disabled 
                                   class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                                <input type="text" id="profile-first-name" value="${profile.first_name || ''}" 
                                       class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                                <input type="text" id="profile-last-name" value="${profile.last_name || ''}" 
                                       class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile</label>
                            <input type="tel" id="profile-mobile" value="${profile.mobile || ''}" 
                                   class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                        </div>

                        <div class="pt-2">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" id="toggle-password-update" class="form-checkbox text-blue-600 rounded">
                                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Change Password</span>
                            </label>
                            <div id="password-update-section" class="hidden mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded border dark:border-gray-600">
                                <div class="mb-3">
                                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New Password</label>
                                    <input type="password" id="profile-new-password" placeholder="Min. 6 characters"
                                           class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confirm Password</label>
                                    <input type="password" id="profile-confirm-password" placeholder="Confirm new password"
                                           class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="p-4 border-t dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-900">
                    <button id="save-profile" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition">
                        Save Changes
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Events
        const imgCircle = document.getElementById('profile-image-circle');
        const imgBtn = document.getElementById('update-image-btn');
        const imgInput = document.getElementById('profile-image-input');
        
        const triggerImg = () => imgInput.click();
        imgCircle.addEventListener('click', triggerImg);
        imgBtn.addEventListener('click', triggerImg);
        imgInput.addEventListener('change', previewProfileImage);

        document.getElementById('toggle-password-update').addEventListener('change', (e) => {
            const section = document.getElementById('password-update-section');
            e.target.checked ? section.classList.remove('hidden') : section.classList.add('hidden');
        });

        document.getElementById('save-profile').addEventListener('click', () => saveUserProfile(profile)); 
        
        const closeModal = () => { if(overlay) overlay.remove(); stagedAvatarFile = null; };
        document.getElementById('cancel-profile').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    } catch (err) {
        console.error("Error loading profile:", err);
        window.showErrorPopup(`Failed to load profile: ${err.message}`);
    }
}

// 3. Preview Image
function previewProfileImage(event) {
    const input = event.target;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (!file.type.startsWith('image/')) {
            window.showErrorPopup("Please select an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            window.showErrorPopup("Image is too large (Max 5MB).");
            return;
        }
        stagedAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => { document.getElementById('profile-image-circle').src = e.target.result; };
        reader.readAsDataURL(file);
    }
}

// 4. Gather Data & Confirm
async function saveUserProfile(originalProfile) {
    const firstName = document.getElementById('profile-first-name')?.value;
    const lastName = document.getElementById('profile-last-name')?.value;
    const mobile = document.getElementById('profile-mobile')?.value;
    const newPassword = document.getElementById('profile-new-password')?.value;
    const confirmPassword = document.getElementById('profile-confirm-password')?.value;
    const isUpdatingPassword = document.getElementById('toggle-password-update')?.checked;

    const profileUpdates = { first_name: firstName, last_name: lastName, mobile: mobile };
    let authUpdates = {};

    if (isUpdatingPassword) {
        if (!newPassword || newPassword.length < 6) { window.showErrorPopup("New password must be at least 6 characters."); return; }
        if (newPassword !== confirmPassword) { window.showErrorPopup("New passwords do not match."); return; }
        authUpdates.password = newPassword;
    }

    if (
        profileUpdates.first_name === (originalProfile.first_name || '') &&
        profileUpdates.last_name === (originalProfile.last_name || '') &&
        profileUpdates.mobile === (originalProfile.mobile || '') &&
        Object.keys(authUpdates).length === 0 &&
        !stagedAvatarFile
    ) {
        window.showSuccessPopup("No changes to save.");
        return;
    }

    showPasswordConfirmModal({ profileUpdates, authUpdates, avatarFile: stagedAvatarFile });
}

// 5. Password Confirmation Modal
function showPasswordConfirmModal(updates) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001]';
    overlay.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm Changes</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Please enter your current password to save changes.</p>
            
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Current Password</label>
            <input type="password" id="current-password-confirm" 
                   class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white mb-2">
            
            <p id="confirm-error-msg" class="text-red-500 text-xs hidden mb-4"></p>
            
            <div class="flex justify-end space-x-3 mt-4">
                <button id="cancel-confirm" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">Cancel</button>
                <button id="confirm-save" class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium">Confirm & Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('#confirm-save');
    const cancelBtn = overlay.querySelector('#cancel-confirm');
    const errorMsg = overlay.querySelector('#confirm-error-msg');
    const passwordInput = overlay.querySelector('#current-password-confirm');

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    confirmBtn.addEventListener('click', async () => {
        const currentPassword = passwordInput.value;
        if (!currentPassword) {
            errorMsg.textContent = "Please enter your password.";
            errorMsg.classList.remove('hidden');
            return;
        }

        errorMsg.classList.add('hidden');
        confirmBtn.textContent = 'Saving...';
        confirmBtn.disabled = true;

        await executeProfileUpdates(currentPassword, updates, close);
        
        if (document.body.contains(overlay)) {
            confirmBtn.textContent = 'Confirm & Save';
            confirmBtn.disabled = false;
        }
    });
}

// 6. Execute Updates (Re-Auth, Upload, Upsert)
async function executeProfileUpdates(currentPassword, updates, closeConfirmModal) {
    const errorMsg = document.getElementById('confirm-error-msg');
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found.");

        // A. Re-authenticate
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (signInError) {
            errorMsg.textContent = "Incorrect password.";
            errorMsg.classList.remove('hidden');
            return;
        }

        // B. Upload Avatar
        let newAvatarUrl = null;
        if (updates.avatarFile) {
            const fileExt = updates.avatarFile.name.split('.').pop();
            // IMPORTANT: Upload to user-specific folder
            const filePath = `profile_pictures/${user.id}/avatar-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('profile_pictures')
                .upload(filePath, updates.avatarFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('profile_pictures')
                .getPublicUrl(filePath);
            
            newAvatarUrl = publicUrlData.publicUrl;
            updates.profileUpdates.profile_picture = newAvatarUrl;
        }

        // C. Update Profile Table
        updates.profileUpdates.updated_at = new Date().toISOString();
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ ...updates.profileUpdates, id: user.id });

        if (profileError) throw profileError;

        // D. Update Password (Auth)
        if (updates.authUpdates.password) {
            const { error: passError } = await supabase.auth.updateUser({ password: updates.authUpdates.password });
            if (passError) throw passError;
        }

        // E. Sync Meta
        const authMetaUpdates = {};
        if (updates.profileUpdates.first_name) authMetaUpdates.first_name = updates.profileUpdates.first_name;
        if (updates.profileUpdates.last_name) authMetaUpdates.last_name = updates.profileUpdates.last_name;
        if (Object.keys(authMetaUpdates).length > 0) {
            await supabase.auth.updateUser({ data: authMetaUpdates });
        }

        window.showSuccessPopup("Profile updated successfully!");
        closeConfirmModal(); // Close password modal
        
        const mainModalOverlay = document.getElementById('profile-modal-overlay');
        if (mainModalOverlay) mainModalOverlay.remove(); // Close main modal

        internalSyncUserProfile(); // Refresh Admin Header

    } catch (err) {
        console.error("Error saving profile:", err);
        errorMsg.textContent = `Error: ${err.message}`;
        errorMsg.classList.remove('hidden');
    }
}

// --- MAIN SCRIPT LOGIC ---

document.addEventListener("DOMContentLoaded", () => {
  console.log("shared.js v13 (Report IDs Fix): DOMContentLoaded");

  // --- Universal Filter Callback ---
  const callPageFilter = () => {
      if (typeof window.applyFilters === "function") {
          window.applyFilters();
      } else {
          console.warn("No page-specific filter function found (window.applyFilters).");
      }
  };

  // --- Sidebar Highlighting (Untouched) ---
  try {
    const links = document.querySelectorAll(".sidebar-link");
    const pathSegments = window.location.pathname.split('/');
    const current = (pathSegments.pop() || 'index.html').toLowerCase();

    links.forEach(link => {
      const href = link.getAttribute("href")?.toLowerCase() || '';
      const isActive = (href === current) || (href === 'index.html' && current === '');

      if (isActive) {
        link.classList.add("bg-primary", "text-white");
        link.classList.remove("text-gray-600", "dark:text-gray-300", "hover:bg-gray-200", "dark:hover:bg-gray-700");
      } else {
        link.classList.add("text-gray-600", "dark:text-gray-300");
        link.classList.remove("bg-primary", "text-white");
        link.addEventListener("mouseenter", () => link.classList.add("bg-gray-200", "dark:bg-gray-700"));
        link.addEventListener("mouseleave", () => link.classList.remove("bg-gray-200", "dark:bg-gray-700"));
      }
    });
  } catch (error) {
      console.error("shared.js: Error during sidebar highlighting:", error);
  }

  // --- Date Dropdown Logic (Untouched) ---
  const dateBtn = document.getElementById("dateDropdownBtn");
  if (dateBtn) {
    try {
        const cloneTemplate = (tplId, targetId) => {
          const tpl = document.getElementById(tplId);
          const target = document.getElementById(targetId);
          if (tpl && target && !target.hasChildNodes()) {
              target.appendChild(tpl.content.cloneNode(true));
          }
        };
        cloneTemplate('calendarIconTemplate', 'calendarIcon');
        cloneTemplate('arrowDownTemplate', 'arrowIcon');

        const dateDropdown = document.getElementById("calendarDropdown");
        const dateLabel = document.getElementById("selectedDate");
        const dateInput = document.getElementById("calendarInput");
        const applyDate = document.getElementById("applyDateBtn");

        window.setupDropdownToggle("dateDropdownBtn", "calendarDropdown");

        if (dateDropdown && dateLabel && dateInput && applyDate) {
          applyDate.addEventListener("click", () => {
            if (!dateInput.value) return;
            const formatted = new Date(dateInput.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            dateLabel.textContent = formatted;
            dateDropdown.classList.add("hidden");
            if (typeof window.filterOutages === "function") window.filterOutages();
            else if (typeof window.filterMarkers === "function") window.filterMarkers();
            else console.warn("No page-specific DATE filter function found (filterOutages or filterMarkers).");
          });

          dateLabel.addEventListener("contextmenu", e => {
            e.preventDefault();
            dateInput.value = '';
            dateLabel.textContent = 'Select Date';
            if (typeof window.filterOutages === "function") window.filterOutages();
            else if (typeof window.filterMarkers === "function") window.filterMarkers();
          });
        }
    } catch (error) {
        console.error("shared.js: Error setting up date filter:", error);
    }
  }

  // --- Feeder Filter UI Logic (Untouched) ---
const feederBtn = document.getElementById("feederFilterBtn");
const feederPopup = document.getElementById("feederPopup");

if (feederBtn && feederPopup) {
    window.setupDropdownToggle("feederFilterBtn", "feederPopup");
    const feederClearAll = document.getElementById("feederClearAll");
    const feederSelectAll = document.getElementById("feederSelectAll");

    const setTogglesState = (select) => {
        const feederToggles = feederPopup.querySelectorAll(".feeder-toggle");
        
        feederToggles.forEach((btn) => {
            if (select) {
                btn.classList.add("bg-blue-500", "text-white");
                btn.classList.remove("bg-gray-200", "dark:bg-gray-700");
            } else {
                btn.classList.remove("bg-blue-500", "text-white");
                btn.classList.add("bg-gray-200", "dark:bg-gray-700");
            }
        });
        callPageFilter(); 
    };

    feederPopup.addEventListener("click", (e) => {
        if (e.target.classList.contains("feeder-toggle")) {
            e.target.classList.toggle("bg-blue-500");
            e.target.classList.toggle("text-white");
            e.target.classList.toggle("bg-gray-200");
            e.target.classList.toggle("dark:bg-gray-700");
            callPageFilter(); 
        }
    });

    feederClearAll?.addEventListener("click", () => setTogglesState(false));
    feederSelectAll?.addEventListener("click", () => setTogglesState(true));
}

 // --- Search Input Logic (Untouched) ---
  const searchInput = document.getElementById("locationSearch");
  if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener("input", () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(callPageFilter, 300);
      });
  }

  // =================================================================
  // REPLACED PROFILE LOGIC INITIALIZATION
  // =================================================================

  // 1. Sync data immediately
  internalSyncUserProfile();

  // 2. Setup Dropdown Toggle
  window.setupDropdownToggle("profileTrigger", "profileDropdown");

  // 3. Setup "Edit Profile" Button to open new Dynamic Modal
  const openProfileModalBtn = document.getElementById('openProfileModalBtn');
  if (openProfileModalBtn) {
      openProfileModalBtn.addEventListener('click', (e) => { 
          e.preventDefault(); 
          // Close the dropdown if it's open
          const dropdown = document.getElementById('profileDropdown');
          if (dropdown) dropdown.classList.add('hidden');
          // Open the new modal
          showProfileModal(); 
      });
  }

  // --- Logout Logic ---
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (window.supabase) {
              await supabase.auth.signOut();
              localStorage.clear();
              window.location.href = 'login.html';
          }
      });
  }

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => console.log('Service Worker registered'))
        .catch(error => console.error('Service Worker registration failed:', error));
    });
  }

}); // End DOMContentLoaded