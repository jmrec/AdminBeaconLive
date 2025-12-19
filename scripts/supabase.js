// ==========================
// SUPABASE CONFIGURATION
// ==========================

const SUPABASE_URL = 'https://ziuteulziywsangbnkgn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdXRldWx6aXl3c2FuZ2Jua2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NjQ4NDQsImV4cCI6MjA3NzQ0MDg0NH0.X2LkaDdouutbHWzotkMNEIdoJBfB9v1CtMQ7KZTXilk';

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
