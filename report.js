import { APP_KEY, APP_NAME, API_TRELLO } from "./lib/app.js";
import { dataCreazioneDaId, giorniApertura, linkSicuro, nomeCondominio, ordinaCommenti } from "./lib/regole.js";

const t = window.TrelloPowerUp.iframe({ appKey: APP_KEY, appName: APP_NAME });
const api = t.getRestApi();

const report = document.getElementById("report");
const stato = document.getElementById("stato");
const autorizza = document.getElementById("autorizza");
const bottoneStampa = document.getElementById("stampa");
const bottoneFinestra = document.getElementById("nuova-finestra");

const FORMATO_DATA = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "long" });
const FORMATO_DATA_ORA = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  dateStyle: "medium",
  timeStyle: "short",
});

const STUDIO = [
  "C.ne Nomentana 484/A 00162 Roma – Piazza Bologna · Tel 0775727301 · info@studiofrattale.com",
  "Via degli Arci 1 03012 Anagni FR · www.studiofrattale.com · Via G. Rasori 20145 Milano MI",
  "Emirates Tower, level 41, Sheikh Zayed Road Dubai",
  "C.F. FRTGLL88H01H501Z · P.I. 12299991005",
];

// Costruisce nodi solo con textContent: nessun dato della card passa mai da innerHTML.
function el(tag, classe, ...figli) {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  for (const figlio of figli) {
    if (figlio == null || figlio === false) continue;
    nodo.append(typeof figlio === "string" || typeof figlio === "number" ? String(figlio) : figlio);
  }
  return nodo;
}

function mostraStato(testo, errore = false) {
  stato.textContent = testo;
  stato.classList.toggle("stato--errore", errore);
  stato.hidden = false;
}

class ErroreAutorizzazione extends Error {}

async function getJson(percorso, token) {
  const url = new URL(`${API_TRELLO}${percorso}`);
  url.searchParams.set("key", APP_KEY);
  url.searchParams.set("token", token);
  const risposta = await fetch(url);
  if (risposta.status === 401) throw new ErroreAutorizzazione();
  if (!risposta.ok) throw new Error(`Trello ha risposto ${risposta.status}`);
  return risposta.json();
}

// FR-003: tutti i commenti, a pagine da 1000 finché Trello ne restituisce una pagina piena.
async function leggiCommenti(idCard, token) {
  const tutti = [];
  let before = null;
  for (;;) {
    const pagina = await getJson(
      `/cards/${idCard}/actions?filter=commentCard&limit=1000${before ? `&before=${before}` : ""}`,
      token,
    );
    tutti.push(...pagina);
    if (pagina.length < 1000) return tutti;
    before = pagina[pagina.length - 1].id;
  }
}

function sezione(titolo, ...contenuto) {
  return el("section", "sezione", el("h2", "sezione__titolo", titolo), ...contenuto);
}

function voceDati(etichetta, valore) {
  return [el("dt", null, etichetta), el("dd", null, valore)];
}

function componiReport({ card, lista, commenti, checklist }) {
  const oggi = new Date();
  const creazione = dataCreazioneDaId(card.id);
  const giorni = giorniApertura(card.id, oggi);

  const testata = el(
    "header",
    "testata",
    el("img", "testata__logo"),
    el("p", "testata__tipo", "Report intervento"),
    el("h1", "testata__titolo", card.name),
    el("p", "testata__condominio", nomeCondominio(card.labels)),
  );
  const logo = testata.querySelector("img");
  logo.src = "./assets/frattale-logo.png";
  logo.alt = "Frattale & Partners";

  const dati = el("dl", "dati");
  dati.append(
    ...voceDati("Stato", lista.name),
    ...voceDati("Membri", (card.members || []).map((m) => m.fullName).join(", ") || "Nessun membro"),
    ...voceDati("Aperto il", FORMATO_DATA.format(creazione)),
    ...voceDati("Giorni dall'apertura", String(giorni)),
  );
  if (card.due) {
    dati.append(
      ...voceDati("Scadenza", `${FORMATO_DATA.format(new Date(card.due))}${card.dueComplete ? " (completata)" : ""}`),
    );
  }

  const descrizione = card.desc?.trim()
    ? el("p", "testo-lungo", card.desc)
    : el("p", "vuoto", "Nessuna descrizione.");

  const cronologia = commenti.length
    ? el(
        "ol",
        "cronologia",
        ...commenti.map((c) =>
          el(
            "li",
            "cronologia__voce",
            el(
              "p",
              "cronologia__intestazione",
              el("span", "cronologia__autore", c.memberCreator?.fullName || "Utente sconosciuto"),
              el("span", "cronologia__data", FORMATO_DATA_ORA.format(new Date(c.date))),
            ),
            el("p", "testo-lungo", c.data?.text || ""),
          ),
        ),
      )
    : el("p", "vuoto", "Nessun commento.");

  const allegati = (card.attachments || []).length
    ? el(
        "ul",
        "elenco",
        ...card.attachments.map((a) => {
          const url = linkSicuro(a.url);
          const nome = a.name || "Allegato senza nome";
          if (!url) return el("li", null, nome);
          const link = el("a", null, nome);
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          return el("li", null, link, el("span", "link-stampa", ` — ${url}`));
        }),
      )
    : el("p", "vuoto", "Nessun allegato.");

  const liste = checklist.length
    ? checklist.map((cl) =>
        el(
          "div",
          "checklist",
          el("h3", "checklist__titolo", cl.name),
          el(
            "ul",
            "checklist__voci",
            ...[...(cl.checkItems || [])]
              .sort((a, b) => a.pos - b.pos)
              .map((v) =>
                el(
                  "li",
                  v.state === "complete" ? "checklist__voce checklist__voce--fatta" : "checklist__voce",
                  el("span", "checklist__segno", v.state === "complete" ? "Fatto" : "Da fare"),
                  v.name,
                ),
              ),
          ),
        ),
      )
    : [el("p", "vuoto", "Nessuna checklist.")];

  const piede = el(
    "footer",
    "piede",
    el("p", "piede__generato", `Report generato il ${FORMATO_DATA_ORA.format(oggi)} da Trello`),
    ...STUDIO.map((riga) => el("p", "piede__studio", riga)),
  );

  report.replaceChildren(
    testata,
    dati,
    sezione("Descrizione", descrizione),
    sezione(`Cronologia (${commenti.length} ${commenti.length === 1 ? "commento" : "commenti"})`, cronologia),
    sezione("Allegati", allegati),
    sezione("Checklist", ...liste),
    piede,
  );
}

async function carica() {
  autorizza.hidden = true;
  report.hidden = true;
  mostraStato("Caricamento dell'intervento…");
  try {
    const token = await api.getToken();
    const [card, lista] = await Promise.all([t.card("all"), t.list("name")]);
    const [commenti, checklist] = await Promise.all([
      leggiCommenti(card.id, token),
      getJson(`/cards/${card.id}/checklists?checkItems=all&checkItem_fields=name,state,pos`, token),
    ]);
    componiReport({ card, lista, commenti: ordinaCommenti(commenti), checklist });
    stato.hidden = true;
    report.hidden = false;
    bottoneStampa.disabled = false;
    bottoneFinestra.disabled = false;
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      await api.clearToken();
      chiediAutorizzazione();
      return;
    }
    // Nessun report parziale: senza commenti il report non sarebbe completo (contracts/powerup.md).
    mostraStato("Impossibile leggere i commenti da Trello: riprova tra poco.", true);
  }
}

function chiediAutorizzazione() {
  stato.hidden = true;
  autorizza.hidden = false;
}

document.getElementById("autorizza-bottone").addEventListener("click", async () => {
  try {
    await api.authorize({ scope: "read", expiration: "never" });
    await carica();
  } catch {
    mostraStato("Autorizzazione non completata. Riprova.", true);
    autorizza.hidden = false;
  }
});

bottoneStampa.addEventListener("click", () => window.print());

// Ripiego se la stampa dentro Trello non si apre: stesso documento in una finestra propria.
// Il contenuto è il DOM già costruito con textContent, quindi già neutralizzato.
bottoneFinestra.addEventListener("click", () => {
  const finestra = window.open("", "_blank");
  if (!finestra) {
    mostraStato("Il browser ha bloccato la nuova finestra: consenti i popup per Trello.", true);
    return;
  }
  const css = new URL("./report.css", window.location.href).href;
  const logo = new URL("./assets/frattale-logo.png", window.location.href).href;
  const copia = report.cloneNode(true);
  copia.hidden = false;
  copia.querySelector(".testata__logo").src = logo;
  finestra.document.title = document.title;
  const link = finestra.document.createElement("link");
  link.rel = "stylesheet";
  link.href = css;
  finestra.document.head.append(link);
  finestra.document.body.append(finestra.document.importNode(copia, true));
  link.addEventListener("load", () => finestra.print());
});

(async () => {
  if (await api.isAuthorized()) await carica();
  else chiediAutorizzazione();
})();
