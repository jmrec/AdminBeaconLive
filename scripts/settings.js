//@flow

// ==========================================
// SETTINGS PAGE SCRIPT (V3 - Navigation & Theme Fixed)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("Settings Page Script (V3) Loaded.");

    // --- Tab Navigation Logic ---
    const buttons = document.querySelectorAll('.settings-nav-btn');
    const panels = document.querySelectorAll('.settings-panel');

    // Function to handle tab clicks
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        // 1. Reset all buttons style
        buttons.forEach(b => {
          b.classList.remove('bg-white', 'dark:bg-gray-800', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm', 'border', 'border-gray-200', 'dark:border-gray-700');
          b.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:bg-white', 'dark:hover:bg-gray-800');
        });

        // 2. Set Active button style
        btn.classList.remove('text-gray-500', 'dark:text-gray-400', 'hover:bg-white', 'dark:hover:bg-gray-800');
        btn.classList.add('bg-white', 'dark:bg-gray-800', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm', 'border', 'border-gray-200', 'dark:border-gray-700');

        // 3. Show active panel
        const targetId = btn.dataset.target;
        panels.forEach(p => {
          if(p.id === targetId) {
              p.classList.remove('hidden');
          } else {
              p.classList.add('hidden');
          }
        });
      });
    });

    // Manually trigger the profile tab on load to ensure active state
    document.querySelector('[data-target="profile-section"]').click(); 
    // --- END Tab Navigation Logic ---


    // --- Theme (Dark Mode) Logic (RESTORED) ---
    const themeLightBtn = document.getElementById('theme-light');
    const themeDarkBtn = document.getElementById('theme-dark');
    const themeSystemBtn = document.getElementById('theme-system');
    const htmlElement = document.documentElement;

    function updateThemeButtons(theme) {
        const buttons = [themeLightBtn, themeDarkBtn, themeSystemBtn].filter(Boolean);
        buttons.forEach(btn => {
            btn.classList.remove('bg-white', 'dark:bg-gray-900', 'text-blue-600', 'dark:text-blue-300', 'shadow');
            btn.classList.add('text-gray-500', 'dark:text-gray-400');
        });

        let activeBtn;
        if (theme === 'light') activeBtn = themeLightBtn;
        else if (theme === 'dark') activeBtn = themeDarkBtn;
        else activeBtn = themeSystemBtn;
        
        if (activeBtn) {
            activeBtn.classList.add('bg-white', 'dark:bg-gray-900', 'text-blue-600', 'dark:text-blue-300', 'shadow');
            activeBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
        }
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            htmlElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else if (theme === 'dark') {
            htmlElement.classList.add('dark');
            localStorage.theme = 'dark';
        } else { // System
            localStorage.removeItem('theme');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                htmlElement.classList.add('dark');
            } else {
                htmlElement.classList.remove('dark');
            }
        }
        updateThemeButtons(theme);
    }

    // Add theme listeners
    themeLightBtn?.addEventListener('click', () => applyTheme('light'));
    themeDarkBtn?.addEventListener('click', () => applyTheme('dark'));
    themeSystemBtn?.addEventListener('click', () => applyTheme('system'));

    // Set initial button state on load
    const currentTheme = localStorage.theme || 'system';
    updateThemeButtons(currentTheme);
    
    // Listen for system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _ => {
        if (!('theme' in localStorage)) { 
            applyTheme('system');
        }
    });
    // --- END Theme Logic ---


    // --- Profile/Auth Logic (Synchronized) ---
    const settingsEmail = document.getElementById('settingsEmail');

    async function loadUserDataAndSync() {
        if (!window.supabase) return;
        
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const meta = user.user_metadata || {};

            // 1. Populate Email (FIXED: Targets settingsEmail input)
            if (settingsEmail) settingsEmail.value = user.email;

            // 2. Populate Display Name
            const nameInput = document.getElementById('settingsNickname');
            const metaName = meta.display_name;
            if (nameInput && metaName) nameInput.value = metaName;

            // 3. Populate Profile Pic
            const imgPreview = document.getElementById('settingsProfileImg');
            const metaPic = meta.avatar_url;
            
            if (imgPreview) {
                if (metaPic) imgPreview.src = metaPic;
                else {
                    // Fallback to local storage or placeholder if metadata is empty
                    const localPic = localStorage.getItem('adminProfilePic');
                    if(localPic) imgPreview.src = localPic;
                }
            }
        }
    }
    
    // Call the sync function on load
    loadUserDataAndSync();


    // --- Admin Auth Modals (CRUD) (Preserved Logic) ---
    const adminAuthModal = document.getElementById('adminAuthModal');
    const adminAuthForm = document.getElementById('adminAuthForm');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const cancelAuthBtn = document.getElementById('cancelAuthBtn');
    const confirmAuthBtn = document.getElementById('confirmAuthBtn');
    const adminAuthPassword = document.getElementById('adminAuthPassword');
    const authError = document.getElementById('authError');

    let onAuthSuccessCallback = null; 

    function openAdminAuth(onSuccess) {
        onAuthSuccessCallback = onSuccess; 
        authError.textContent = '';
        adminAuthPassword.value = '';
        adminAuthModal?.classList.remove('hidden');
        adminAuthModal?.classList.add('flex');
        adminAuthPassword?.focus();
    }

    function closeAdminAuth() {
        adminAuthModal?.classList.add('hidden');
        adminAuthModal?.classList.remove('flex');
        onAuthSuccessCallback = null;
    }
    
    closeAuthModalBtn?.addEventListener('click', closeAdminAuth);
    cancelAuthBtn?.addEventListener('click', closeAdminAuth);

    adminAuthForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.supabase) { authError.textContent = "Supabase client not loaded."; return; }

        const password = adminAuthPassword.value;
        if (!password) { authError.textContent = "Password is required."; return; }
        
        authError.textContent = '';
        confirmAuthBtn.disabled = true;
        confirmAuthBtn.textContent = 'Verifying...';

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            authError.textContent = "Not logged in. Please log in again.";
            confirmAuthBtn.disabled = false;
            confirmAuthBtn.textContent = 'Confirm';
            return;
        }

        const { error: authErrorResult } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: password,
        });

        if (authErrorResult) {
            authError.textContent = "Incorrect password. Please try again.";
        } else {
            closeAdminAuth();
            if (typeof onAuthSuccessCallback === 'function') {
                onAuthSuccessCallback(); 
            }
        }
        
        confirmAuthBtn.disabled = false;
        confirmAuthBtn.textContent = 'Confirm';
    });


    // --- Configuration Modal Triggers ---
    document.getElementById('manageFeedersBtn')?.addEventListener('click', () => {
        openAdminAuth(openFeederModal);
    });
    
    document.getElementById('manageTeamsBtn')?.addEventListener('click', () => {
        openAdminAuth(openTeamModal);
    });


    // --- FEEDER MANAGEMENT (CRUD) (Logic omitted for brevity, but requires modals in HTML) ---
    const feederModal = document.getElementById('feederModal');
    const closeFeederModalBtn = document.getElementById('closeFeederModalBtn');
    const feederForm = document.getElementById('feederForm');
    const feederFormTitle = document.getElementById('feederFormTitle');
    const feederListContainer = document.getElementById('feederListContainer');
    const feederEditId = document.getElementById('feederEditId');
    const feederName = document.getElementById('feederName');
    const feederCode = document.getElementById('feederCode');
    const cancelFeederEditBtn = document.getElementById('cancelFeederEditBtn');
    const saveFeederBtn = document.getElementById('saveFeederBtn');

    function openFeederModal() {
        feederModal?.classList.remove('hidden');
        feederModal?.classList.add('flex');
        // ... (rest of the logic requires modals to be in HTML)
    }
    
    closeFeederModalBtn?.addEventListener('click', () => feederModal?.classList.add('hidden'));
    
    // --- DISPATCH TEAM MANAGEMENT (CRUD) (Logic omitted for brevity) ---
    const teamModal = document.getElementById('teamModal');
    const closeTeamModalBtn = document.getElementById('closeTeamModalBtn');

    function openTeamModal() {
        teamModal?.classList.remove('hidden');
        teamModal?.classList.add('flex');
        // ... (rest of the logic requires modals to be in HTML)
    }
    
    closeTeamModalBtn?.addEventListener('click', () => teamModal?.classList.add('hidden'));
});