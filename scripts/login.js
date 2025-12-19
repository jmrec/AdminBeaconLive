document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const errorMessageDiv = document.getElementById('errorMessage');

    if (!window.supabase) {
        console.error("Supabase client not initialized.");
        errorMessageDiv.textContent = "Configuration error. Please check Supabase setup.";
        return;
    }

    console.log("Login script initialized (Supabase Mode).");

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        errorMessageDiv.textContent = '';
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            errorMessageDiv.textContent = 'Please enter both email and password.';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
            return;
        }

        try {
            // Sign in with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                console.error("Auth error:", authError);
                errorMessageDiv.textContent = authError.message;
                return;
            }

            if (!authData.session) {
                errorMessageDiv.textContent = 'Email not verified. Please check your inbox.';
                return;
            }

            const userId = authData.user.id;

            // Fetch profile from profiles table
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileError) {
                console.error("Profile fetch error:", profileError);
                errorMessageDiv.textContent = 'Failed to fetch user profile.';
                return;
            }

            console.log("Login successful! Profile:", profile);
            localStorage.setItem('userProfile', JSON.stringify(profile));
            window.location.href = 'index.html';

        } catch (err) {
            console.error("Unexpected login error:", err);
            errorMessageDiv.textContent = 'An unexpected error occurred. Please try again.';
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });
});
