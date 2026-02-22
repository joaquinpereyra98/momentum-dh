import { Flip } from "/scripts/greensock/esm/all.js";
import * as apps from "./module/apps/_module.mjs";
import * as hooks from "./module/hooks/_module.mjs";

import { MODULE_ID, SPOTLIGHT_TRACKER_ID } from "./module/constants.mjs";

Hooks.on("init", () => {
  gsap.registerPlugin(Flip);

  const moduleData = game.modules.get(MODULE_ID);

  moduleData.api = {
    apps: { ...apps },
  };

  globalThis.momentum = moduleData.api;

  CONFIG.ui[SPOTLIGHT_TRACKER_ID] = apps.SpotlightTracker;

  console.log(`${MODULE_ID} | Initialized`);
});

Hooks.on("ready", () => {
  const left = momentum.apps.SpotlightTracker.create({
    side: "left",
    parent: "#ui-left-column-2",
    classes: ["left-zone"],
  });
  const right = momentum.apps.SpotlightTracker.create({
    side: "right",
    parent: "#ui-right-column-1",
    classes: ["right-zone"],
  });

  ui[left.id] = left;
  ui[right.id] = right;

  if (game.combat) momentum.apps.SpotlightTracker.renderAll({ force: true });
});

/**
 *
 * @param {foundry.documents.Combat|foundry.documents.Combatant} document
 */
const renderSpotlight = (document) => {
  const { SpotlightTracker } = momentum.apps;
  const isRendered = SpotlightTracker.isRendered;
  const combat =
    document instanceof foundry.documents.Combat ? document : document.combat;
  if (combat === game.combat)
    SpotlightTracker.renderAll({ force: !isRendered });
  if (!game.combat) SpotlightTracker.closeAll();
};

[
  "createCombatant",
  "deleteCombatant",
  "updateCombatant",
  "createCombat",
  "deleteCombat",
  "updateCombat",
].forEach((hook) => {
  Hooks.on(hook, renderSpotlight);
});

Hooks.on("renderCombatTracker", hooks.onRenderCombatTracker);
