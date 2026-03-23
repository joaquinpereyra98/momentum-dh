import { MODULE_ID, SETTINGS } from "./constants.mjs";

export default function registerSettings() {
  
  const updateTracker = (value, isPC) => {
    const instances = momentum.apps.SpotlightTracker.instances.values();
    const app = Array.from(instances).find((a) => a.isPCTracker === isPC);

    if (!app) return;
    return value ? app.render({ force: true }) : app.close();
  };

  game.settings.register(MODULE_ID, SETTINGS.showAdversaries, {
    name: "Show Adversaries Tracker",
    hint: "If enabled, show the Adversaries Tracker. If disabled, the tracker remains hidden",
    config: true,
    scope: "client",
    type: Boolean,
    default: true,
    onChange: (val) => updateTracker(val, false),
  });
  game.settings.register(MODULE_ID, SETTINGS.showPlayers, {
    name: "Show Players Tracker",
    hint: "If enabled, show the Players Tracker. If disabled, the tracker remains hidden",
    config: true,
    scope: "client",
    type: Boolean,
    default: true,
    onChange: (val) => updateTracker(val, true),
  });
}
