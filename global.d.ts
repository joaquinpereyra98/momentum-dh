/**FOUNDRY TYPES */
import "@client/global.mjs";
import Canvas from "@client/canvas/board.mjs";
import * as GSAP from "@gsap/gsap-core";
import FlipModule from "@gsap/Flip.js";

type moduleApps = typeof import("./module/apps/_module.mjs");
type moduleHooks = typeof import("./module/hooks/_module.mjs");

// Foundry's use of `Object.assign(globalThis)` means many globally available objects are not read as such
// This declare global hopefully fixes that
declare global {
  /**
   * A simple event framework used throughout Foundry Virtual Tabletop.
   * When key actions or events occur, a "hook" is defined where user-defined callback functions can execute.
   * This class manages the registration and execution of hooked callback functions.
   */
  class Hooks extends foundry.helpers.Hooks {}

  const fromUuid: typeof foundry.utils.fromUuid;
  const fromUuidSync: typeof foundry.utils.fromUuidSync;

  /**
   * The singleton game canvas
   */
  const canvas: Canvas;

  const gsap: typeof GSAP.gsap;
  const Flip: typeof FlipModule;

  /**
   * Momentum Module Global API
   */
  var momentum: {
    apps: moduleApps;
    hooks: moduleHooks;
  };
}
