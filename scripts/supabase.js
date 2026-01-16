//@flow

// ==========================
// SUPABASE CONFIGURATION
// ==========================

// Declare global supabase variable
/**
 * @typedef {Object} SupabaseClient
 * @property {function(string): any} from - Access a table
 * @property {Object} auth - Authentication methods
 * @property {Object} storage - Storage methods
 */

// @ts-ignore - Declare global variable
if (!window.supabase) {
    /** @type {SupabaseClient} */
    // @ts-ignore - supabase is loaded from CDN
    const supabase = window.supabase || {};
    
    /** @type {string} Supabase project URL */
    const SUPABASE_URL = 'https://ziuteulziywsangbnkgn.supabase.co';
    
    /** @type {string} Supabase anonymous public key */
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdXRldWx6aXl3c2FuZ2Jua2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NjQ4NDQsImV4cCI6MjA3NzQ0MDg0NH0.X2LkaDdouutbHWzotkMNEIdoJBfB9v1CtMQ7KZTXilk';
    
    // Create Supabase client if supabase library is available
    if (supabase.createClient) {
        /** @type {SupabaseClient} */
        const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        // @ts-ignore - Assign to window
        window.supabase = client;
    }
}
