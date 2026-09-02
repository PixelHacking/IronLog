// ============================================================
// CONFIGURA QUI le credenziali del tuo progetto Supabase.
// Le trovi in: Project Settings -> API (nel dashboard Supabase)
// ============================================================
window.SUPABASE_CONFIG = {
  url: "https://TUO-PROGETTO.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imttbmt6emR6eGdjeGRhbHlydGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTc5MjMsImV4cCI6MjEwMzgzMzkyM30.JNb4XB5ZbPcpf2qmRYb-5zNancMkUYd-4atEAl2DrkM"
};

// L'email con cui accedi TU come amministratore: deve coincidere
// ESATTAMENTE (anche maiuscole/minuscole) con quella inserita al
// posto di 'ADMIN_EMAIL_HERE' in supabase-schema-pro-upgrade.sql.
// Serve solo a mostrare/nascondere il pannello admin in questa app:
// il controllo di sicurezza vero avviene lato server su Supabase.
window.ADMIN_EMAIL = "marcopazienza2013@gmail.com";

