import { Flip, Observer } from "/scripts/greensock/esm/all.js";
import * as apps from "./module/apps/_module.mjs";
import * as hooks from "./module/hooks/_module.mjs";
import { MODULE_ID, SPOTLIGHT_TRACKER_ID } from "./module/constants.mjs";
import registerSettings from "./module/settings.mjs";

Hooks.on("init", () => {
  gsap.registerPlugin(Flip);
  gsap.registerPlugin(Observer);

  const moduleData = game.modules.get(MODULE_ID);

  moduleData.api = {
    gsap: { Flip, Observer },
    apps: { ...apps },
  };

  globalThis.momentum = moduleData.api;

  CONFIG.ui[SPOTLIGHT_TRACKER_ID] = apps.SpotlightTracker;
  registerSettings();

  console.log(`${MODULE_ID} | Initialized`);
});

Hooks.on("ready", () => {
  const { SpotlightTracker } = momentum.apps;
  const left = SpotlightTracker.create({
    side: "left",
    parent: "#ui-left-column-2",
    classes: ["left-zone"],
  });
  const right = SpotlightTracker.create({
    side: "right",
    parent: "#ui-right-column-1",
    classes: ["right-zone"],
  });

  ui[left.id] = left;
  ui[right.id] = right;

  if (game.combat) SpotlightTracker.renderAll({ force: true });
});

/**
 * @param {foundry.documents.Combat} combat
 */
const handleCombatChange = (combat) => {
  const { SpotlightTracker } = momentum.apps;

  if (combat === game.combat) SpotlightTracker.renderAll({ force: true });
  if (!game.combat) SpotlightTracker.closeAll();
};

["createCombat", "deleteCombat"].forEach((hook) =>
  Hooks.on(hook, handleCombatChange),
);

Hooks.on("renderCombatTracker", hooks.onRenderCombatTracker);
