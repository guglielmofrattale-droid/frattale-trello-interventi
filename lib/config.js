import { validaConfig } from "./regole.js";

// Configurazione condivisa della bacheca (data-model.md); null se assente o non valida, così
// badge e selezioni non partono mai da una configurazione incoerente.
export async function leggiConfig(t) {
  const config = await t.get("board", "shared", "config");
  if (!config || validaConfig(config).length > 0) return null;
  return config;
}
