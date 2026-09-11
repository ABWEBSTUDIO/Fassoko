const SUPABASE_URL = "https://rcflcepyzzgrbbpwgmac.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_E3OBEZTy5EOUBAutzzlVOw_20OIVmv0";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log("Supabase connected:", !!supabaseClient);