// Crea il client Supabase. persistSession + autoRefreshToken mantengono
// l'utente collegato tra una visita e l'altra (sessione salvata in localStorage).
const { createClient } = supabase;

window.sb = createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "gym-tracker-auth"
    }
  }
);
