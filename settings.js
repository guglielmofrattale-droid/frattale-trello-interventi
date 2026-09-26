import { APP_KEY, APP_NAME } from "./lib/app.js";
import { validaConfig } from "./lib/regole.js";

const t = window.TrelloPowerUp.iframe({ appKey: APP_KEY, appName: APP_NAME });

const form = document.getElementById("contenuto");
const selectAperti = document.getElementById("lista-aperti");
const contenitoreChiuse = document.getElementById("liste-chiuse");
const inputSoglia = document.getElementById("soglia");
const elencoErrori = document.getElementById("errori");
const esito = document.getElementById("esito");
const bottoneSalva = document.getElementById("salva");
const idListaAperti = document.getElementById("id-lista-aperti");

function opzione(valore, testo) {
  const o = document.createElement("option");
  o.value = valore;
  o.textContent = testo;
  return o;
}

function leggiForm() {
  return {
    versione: 1,
    listaAperti: selectAperti.value,
    listeChiuse: [...contenitoreChiuse.querySelectorAll("input:checked")].map((c) => c.value),
    sogliaGiorni: Number(inputSoglia.value),
  };
}

function mostraErrori(errori) {
  elencoErrori.replaceChildren(
    ...errori.map((e) => {
      const li = document.createElement("li");
      li.textContent = e;
      return li;
    }),
  );
  elencoErrori.hidden = errori.length === 0;
}

function aggiornaDimensione() {
  t.sizeTo("#contenuto").catch(() => {});
}

async function avvia() {
  const [liste, bacheca, membro, config] = await Promise.all([
    t.lists("id", "name"),
    t.board("id", "memberships"),
    t.member("id"),
    t.get("board", "shared", "config"),
  ]);
  const admin = (bacheca.memberships || []).some(
    (m) => m.idMember === membro.id && m.memberType === "admin",
  );

  selectAperti.replaceChildren(opzione("", "Scegli una lista…"), ...liste.map((l) => opzione(l.id, l.name)));
  contenitoreChiuse.replaceChildren(
    ...liste.map((l) => {
      const etichetta = document.createElement("label");
      etichetta.className = "scelta";
      const casella = document.createElement("input");
      casella.type = "checkbox";
      casella.value = l.id;
      casella.checked = (config?.listeChiuse || []).includes(l.id);
      etichetta.append(casella, document.createTextNode(l.name));
      return etichetta;
    }),
  );
  selectAperti.value = config?.listaAperti || "";
  inputSoglia.value = String(config?.sogliaGiorni ?? 15);
  document.getElementById("id-bacheca").textContent = bacheca.id;
  idListaAperti.textContent = config?.listaAperti || "—";

  if (!admin) {
    document.getElementById("solo-lettura").hidden = false;
    for (const campo of form.querySelectorAll("select, input, button")) campo.disabled = true;
  }
  aggiornaDimensione();
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  esito.hidden = true;
  const config = leggiForm();
  const errori = validaConfig(config);
  mostraErrori(errori);
  if (errori.length) {
    aggiornaDimensione();
    return;
  }
  bottoneSalva.disabled = true;
  try {
    await t.set("board", "shared", "config", config);
    idListaAperti.textContent = config.listaAperti;
    esito.textContent = "Impostazioni salvate.";
    esito.hidden = false;
  } catch {
    mostraErrori(["Salvataggio non riuscito: riprova."]);
  } finally {
    bottoneSalva.disabled = false;
    aggiornaDimensione();
  }
});

form.addEventListener("toggle", aggiornaDimensione, true);

avvia().catch(() => mostraErrori(["Impossibile leggere le liste della bacheca."]));
