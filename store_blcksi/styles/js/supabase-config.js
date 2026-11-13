
/*
 * BLCKSI Store — configuração pública do Supabase.
 * Nunca colocar service_role no frontend.
 */

window.BLCKSI_SUPABASE = {
  url: "https://jqrgfpdqgyimlzcpkkae.supabase.co",
  key: "sb_publishable_Z8yDWnBTIUiLdwYtxUVecg_BruanFWH"
};

window.BLCKSI_CLIENT = window.supabase.createClient(
  window.BLCKSI_SUPABASE.url,
  window.BLCKSI_SUPABASE.key
);

