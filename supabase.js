const SUPABASE_URL = "https://pgwsjxokhsvlziouwjsd.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_FKpcv4cvX3e4eQg6JdLMUw_zA9kfQPx";

window.sb = supabase.createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
);
