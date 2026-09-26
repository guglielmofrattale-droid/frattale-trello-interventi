import { APP_KEY, APP_NAME } from "./lib/app.js";
import { leggiConfig } from "./lib/config.js";
import { giorniApertura, statoCard } from "./lib/regole.js";

const base = new URL(".", window.location.href).href;

window.TrelloPowerUp.initialize(
  {
    // FR-001: report dal retro di ogni card.
    "card-buttons": () => [
      {
        icon: `${base}assets/frattale-icon.png`,
        text: "Report intervento",
        callback: (t) =>
          t.modal({ url: "./report.html", fullscreen: true, title: "Report intervento" }),
      },
    ],

    // FR-005/006/007: anzianità solo sulle card aperte, rossa oltre soglia; nessuna chiamata REST.
    "card-badges": async (t) => {
      const [card, config] = await Promise.all([t.card("id", "idList"), leggiConfig(t)]);
      if (statoCard(card.idList, config) !== "aperto") return [];
      const giorni = giorniApertura(card.id, new Date());
      return [
        {
          text: `aperto da ${giorni} ${giorni === 1 ? "giorno" : "giorni"}`,
          color: giorni > config.sogliaGiorni ? "red" : null,
        },
      ];
    },

    "show-settings": (t) =>
      t.popup({ title: "Impostazioni Interventi Studio", url: "./settings.html", height: 420 }),
  },
  { appKey: APP_KEY, appName: APP_NAME },
);
