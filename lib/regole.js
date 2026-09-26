// Regole pure condivise tra Power-Up (browser) e workflow n8n (nodi Code).
// Nessun import né API del browser: il file, senza l'ultima riga `export`, viene incollato
// identico nei nodi Code di n8n (tests/workflow-sync.test.mjs lo verifica).

const FUSO = "Europe/Rome";
const MS_GIORNO = 86400000;

function dataRoma(data) {
  const parti = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const v = (tipo) => Number(parti.find((p) => p.type === tipo).value);
  return { anno: v("year"), mese: v("month"), giorno: v("day") };
}

function isoRoma(data) {
  const { anno, mese, giorno } = dataRoma(data);
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

function dataCreazioneDaId(id) {
  return new Date(parseInt(String(id).slice(0, 8), 16) * 1000);
}

function giorniApertura(id, oggi) {
  const a = dataRoma(dataCreazioneDaId(id));
  const b = dataRoma(oggi);
  return Math.round(
    (Date.UTC(b.anno, b.mese - 1, b.giorno) - Date.UTC(a.anno, a.mese - 1, a.giorno)) / MS_GIORNO,
  );
}

function statoCard(idList, config) {
  if (!config) return "altro";
  if (idList === config.listaAperti) return "aperto";
  if ((config.listeChiuse || []).includes(idList)) return "chiuso";
  return "altro";
}

// Algoritmo anonimo gregoriano (Meeus/Jones/Butcher).
function pasqua(anno) {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return { mese, giorno };
}

function festiviItaliani(anno, aggiuntivi) {
  const fissi = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"];
  const p = pasqua(anno);
  const pasquetta = new Date(Date.UTC(anno, p.mese - 1, p.giorno + 1));
  const mmdd = `${String(pasquetta.getUTCMonth() + 1).padStart(2, "0")}-${String(pasquetta.getUTCDate()).padStart(2, "0")}`;
  return new Set([...fissi, mmdd, ...(aggiuntivi || [])]);
}

function giornoLavorativo(data, aggiuntivi) {
  const { anno, mese, giorno } = dataRoma(data);
  const settimana = new Date(Date.UTC(anno, mese - 1, giorno)).getUTCDay();
  if (settimana === 0 || settimana === 6) return false;
  const mmdd = `${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
  return !festiviItaliani(anno, aggiuntivi).has(mmdd);
}

function validaConfig(config) {
  const errori = [];
  if (!config || typeof config !== "object") return ["Configurazione assente"];
  if (!config.listaAperti) errori.push("Lista interventi aperti non indicata");
  if ((config.listeChiuse || []).includes(config.listaAperti)) {
    errori.push("La lista degli interventi aperti non può essere anche una lista chiusa");
  }
  const s = config.sogliaGiorni;
  if (!Number.isInteger(s) || s < 1 || s > 365) errori.push("La soglia deve essere un intero tra 1 e 365");
  return errori;
}

function nomeCondominio(labels) {
  const nomi = (labels || []).map((l) => (l && l.name ? String(l.name).trim() : "")).filter(Boolean);
  return nomi.length ? nomi.join(", ") : "Condominio non indicato";
}

function linkSicuro(url) {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function ordinaCommenti(azioni) {
  return [...(azioni || [])].sort((x, y) => new Date(x.date) - new Date(y.date));
}

function selezionaInRitardo(cards, config, oggi) {
  return (cards || [])
    .filter((c) => !c.idList || statoCard(c.idList, config) === "aperto")
    .map((c) => ({
      titolo: c.name,
      condominio: nomeCondominio(c.labels),
      membri: (c.members || []).map((m) => m.fullName).filter(Boolean).join(", ") || "nessun membro",
      giorni: giorniApertura(c.id, oggi),
      link: linkSicuro(c.shortUrl),
    }))
    .filter((r) => r.giorni > config.sogliaGiorni)
    .sort((x, y) => y.giorni - x.giorni);
}

function escapeHtml(testo) {
  return String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function componiEmail(righe, soglia) {
  const n = righe.length;
  const oggetto = `Interventi in ritardo: ${n} ${n === 1 ? "aperto" : "aperti"} da oltre ${soglia} giorni`;
  const testo = righe
    .map((r) => `${r.titolo} — ${r.condominio} — ${r.membri}\nAperto da ${r.giorni} giorni · ${r.link || "link non disponibile"}`)
    .join("\n\n");
  const voci = righe
    .map((r) => {
      const link = r.link
        ? ` · <a href="${escapeHtml(r.link)}">apri la card</a>`
        : "";
      return (
        `<li style="margin-bottom:12px"><strong>${escapeHtml(r.titolo)}</strong><br>` +
        `${escapeHtml(r.condominio)} — ${escapeHtml(r.membri)}<br>` +
        `<span style="color:#8B1A2F">Aperto da ${r.giorni} giorni</span>${link}</li>`
      );
    })
    .join("");
  const html =
    `<div style="font-family:'Times New Roman',Times,serif;font-size:15px;color:#000">` +
    `<p>Interventi nella lista Manutenzioni aperti da oltre ${soglia} giorni:</p>` +
    `<ul style="padding-left:18px">${voci}</ul>` +
    `<p style="color:#3D3D3D;font-size:12px">Frattale &amp; Partners — riepilogo automatico</p></div>`;
  return { oggetto, html, testo };
}

export { dataRoma, isoRoma, dataCreazioneDaId, giorniApertura, statoCard, pasqua, festiviItaliani, giornoLavorativo, validaConfig, nomeCondominio, linkSicuro, ordinaCommenti, selezionaInRitardo, escapeHtml, componiEmail };
