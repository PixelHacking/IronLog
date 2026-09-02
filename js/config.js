// ============================================================
// CONFIGURA QUI le credenziali del tuo progetto Supabase.
// Le trovi in: Project Settings -> API (nel dashboard Supabase)
// ============================================================
window.SUPABASE_CONFIG = {
  url: "https://TUO-PROGETTO.supabase.co",
  anonKey: "INCOLLA_QUI_LA_TUA_ANON_KEY"
};

// L'email con cui accedi TU come amministratore: deve coincidere
// ESATTAMENTE (anche maiuscole/minuscole) con quella inserita al
// posto di 'ADMIN_EMAIL_HERE' in supabase-schema-pro-upgrade.sql.
// Serve solo a mostrare/nascondere il pannello admin in questa app:
// il controllo di sicurezza vero avviene lato server su Supabase.
window.ADMIN_EMAIL = "marcopazienza2013@gmail.com";

