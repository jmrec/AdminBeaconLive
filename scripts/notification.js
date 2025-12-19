// NOTIFICATIONS.JS - Handles the Notification Feed UI

document.addEventListener("DOMContentLoaded", async () => {
  const feedContainer = document.getElementById("notification-feed");
  const unreadCountDisplay = document.getElementById("unreadCountDisplay");
  const markAllReadBtn = document.getElementById("markAllReadBtn");
  const filterAllBtn = document.getElementById("filterAllBtn");
  const filterUnreadBtn = document.getElementById("filterUnreadBtn");
  
  // State
  let currentFilter = 'all'; // 'all' or 'unread'
  let notificationsChannel = null;

  // Initialize
  loadNotifications();
  subscribeRealtime();

  // --- 1. Fetch & Render ---
  async function loadNotifications() {
    if (!feedContainer) return;
    
    feedContainer.innerHTML = `
        <div class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    `;

    let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Limit to recent 50

    if (currentFilter === 'unread') {
        query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error loading notifications:", error);
        feedContainer.innerHTML = `<div class="text-center text-red-500 py-4">Failed to load notifications.</div>`;
        return;
    }

    renderList(data);
    updateUnreadCount();
  }

  function renderList(notifications) {
    feedContainer.innerHTML = "";

    if (!notifications || notifications.length === 0) {
        feedContainer.innerHTML = `
            <div id="feed-placeholder" class="flex flex-col items-center justify-center py-16 text-gray-400">
                <span class="material-icons text-4xl mb-2">notifications_off</span>
                <p class="text-sm font-medium">No notifications found</p>
            </div>
        `;
        return;
    }

    const frag = document.createDocumentFragment();

    notifications.forEach(notif => {
        const isRead = notif.is_read;
        const timeAgo = getTimeAgo(new Date(notif.created_at));
        
        // Style based on Type
        let icon = "info";
        let colorClass = "bg-blue-100 text-blue-600";
        let borderClass = "border-l-4 border-blue-500";

        if (notif.type === 'Critical' || notif.type === 'surge') {
            icon = "warning";
            colorClass = "bg-red-100 text-red-600";
            borderClass = "border-l-4 border-red-500";
        } else if (notif.type === 'Warning' || notif.type === 'sla_breach') {
            icon = "access_time";
            colorClass = "bg-orange-100 text-orange-600";
            borderClass = "border-l-4 border-orange-500";
        } else if (notif.type === 'Info' || notif.type === 'recurring') {
            icon = "history";
            colorClass = "bg-purple-100 text-purple-600";
            borderClass = "border-l-4 border-purple-500";
        } else if (notif.type === 'Update' || notif.type === 'forecast') {
            icon = "trending_up";
            colorClass = "bg-teal-100 text-teal-600";
            borderClass = "border-l-4 border-teal-500";
        }

        const card = document.createElement("div");
        card.className = `
            relative bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 
            transition-all hover:shadow-md ${isRead ? 'opacity-75' : 'bg-blue-50/30 dark:bg-blue-900/10'} 
            ${borderClass}
        `;

        card.innerHTML = `
            <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center shrink-0">
                    <span class="material-icons text-xl">${icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <h4 class="text-sm font-bold text-gray-800 dark:text-gray-100 ${isRead ? '' : 'text-blue-700 dark:text-blue-400'}">
                            ${notif.title}
                        </h4>
                        <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${timeAgo}</span>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                        ${notif.message}
                    </p>
                </div>
                ${!isRead ? `
                    <button class="mark-read-btn text-gray-300 hover:text-blue-600 transition p-1" title="Mark as read" data-id="${notif.id}">
                        <span class="material-icons text-lg">check_circle_outline</span>
                    </button>
                ` : ''}
            </div>
        `;

        // Add Click Listener to Mark as Read
        const markBtn = card.querySelector(".mark-read-btn");
        if (markBtn) {
            markBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                markAsRead(notif.id);
            });
        }

        frag.appendChild(card);
    });
    feedContainer.appendChild(frag);
  }

  // --- 2. Actions ---
  
  async function markAsRead(id) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

    if (error) {
        console.error("Error marking as read:", error);
    } else {
        // Optimistic update UI
        loadNotifications();
        // Update global badge
        if (window.updateNotificationBadge) window.updateNotificationBadge();
    }
  }

  async function markAllAsRead() {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

    if (error) {
        window.showSuccessPopup("Error marking all read");
    } else {
        window.showSuccessPopup("All notifications marked as read");
        loadNotifications();
        if (window.updateNotificationBadge) window.updateNotificationBadge();
    }
  }

  async function updateUnreadCount() {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
    
    if (!error && unreadCountDisplay) {
        unreadCountDisplay.textContent = typeof count === 'number' ? count : 0;
    }
  }

  // --- 3. Filters & Listeners ---

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener("click", markAllAsRead);
  }

  if (filterAllBtn && filterUnreadBtn) {
    filterAllBtn.addEventListener("click", () => {
        currentFilter = 'all';
        toggleFilterStyles(filterAllBtn, filterUnreadBtn);
        loadNotifications();
    });

    filterUnreadBtn.addEventListener("click", () => {
        currentFilter = 'unread';
        toggleFilterStyles(filterUnreadBtn, filterAllBtn);
        loadNotifications();
    });
  }

  function toggleFilterStyles(activeBtn, inactiveBtn) {
    activeBtn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-500', 'hover:bg-gray-200/50');
    activeBtn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow', 'text-blue-600', 'dark:text-blue-400');
    
    inactiveBtn.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'hover:bg-gray-200/50');
    inactiveBtn.classList.remove('shadow', 'text-blue-600', 'dark:text-blue-400', 'bg-white');
  }

  function subscribeRealtime() {
    if (!window.supabase) return;
    notificationsChannel = supabase
      .channel('notifications-feed')
      .on('postgres_changes', { event: 'insert', schema: 'public', table: 'notifications' }, (payload) => {
        if (currentFilter === 'all' || (currentFilter === 'unread' && payload.new && payload.new.is_read === false)) {
          loadNotifications();
        }
        updateUnreadCount();
        if (window.updateNotificationBadge) window.updateNotificationBadge();
      })
      .on('postgres_changes', { event: 'update', schema: 'public', table: 'notifications' }, () => {
        updateUnreadCount();
        if (currentFilter !== 'all') loadNotifications();
        if (window.updateNotificationBadge) window.updateNotificationBadge();
      })
      .subscribe();
  }

  window.addEventListener('beforeunload', () => {
    if (notificationsChannel) supabase.removeChannel(notificationsChannel);
  });

  // Helper: Time Ago
  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
  }

});
