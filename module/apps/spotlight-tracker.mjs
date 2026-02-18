import { MODULE_ID, TEMPLATES_PATH } from "../constants.mjs";

const { ApplicationV2 } = foundry.applications.api;

const SPOTLIGHT_TEMPLATES = `${TEMPLATES_PATH}/spotlight-tracker`;

/** The Spotlight Tracker */
export default class SpotlightTracker extends ApplicationV2 {
  /* -------------------------------------------- */
  /* Static Properties & Methods                  */
  /* -------------------------------------------- */

  /** @type {foundry.applications.types.ApplicationConfiguration} */
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-spotlight-tracker-{side}`,
    tag: "ul",
    classes: [MODULE_ID, "spotlight-tracker", "unlist"],
    window: {
      frame: false,
      positioned: false,
    },
    actions: {
      setSpotlight: SpotlightTracker.#onSetSpotlight,
      combatantClick: SpotlightTracker.#onCombatantClick,
      requestSpotlight: SpotlightTracker.#onRequestSpotlight,
    },
  };

  /**
   * Internal registry of tracker instances, keyed by their unique ID.
   * @type {Map<string, SpotlightTracker>}
   * @private
   */
  static instances = new Map();

  /**
   * Creates and registers a new tracker, or returns the existing one if the ID exists.
   * @param {Object} [options={}] - Configuration for the tracker.
   * @returns {SpotlightTracker} The tracked instance.
   */
  static create(options = {}) {
    const app = new SpotlightTracker(options);
    if (!this.instances.has(app.id)) this.instances.set(app.id, app);
    return this.instances.get(app.id);
  }

  /**
   * Renders all registered trackers concurrently.
   * @param {Partial<foundry.applications.types.ApplicationRenderOptions>} options - Options to pass to each render call.
   * @returns {Promise<SpotlightTracker[]>} A promise that resolves when all renders complete.
   */
  static async renderAll(options = {}) {
    const tasks = Array.from(this.instances.values(), (app) =>
      app.render(options),
    );
    return Promise.all(tasks);
  }

  /**
   * Renders all registered trackers concurrently.
   * @param {Partial<foundry.applications.types.ApplicationClosingOptions>} options - Options to pass to each render call.
   * @returns {Promise<SpotlightTracker[]>} A promise that resolves when all renders complete.
   */
  static async closeAll(options = {}) {
    const tasks = Array.from(this.instances.values(), (app) =>
      app.close(options),
    );
    return Promise.all(tasks);
  }

  /**
   * Check whether all SpotlightTracker instances are currently rendered.
   * @returns {boolean} True if all instances are rendered, otherwise false.
   */
  static get isRendered() {
    for (const instance of this.instances.values()) {
      if (instance.state !== this.RENDER_STATES.RENDERED) return false;
    }
    return true;
  }

  /* -------------------------------------------- */
  /* Properties & Getters                         */
  /* -------------------------------------------- */

  /**@type {foundry.documents.Combat|null} */
  get activeCombat() {
    return game.combat;
  }

  get isPCTracker() {
    return this.options.side === "left";
  }

  /**@type {HTMLCollection} */
  #listItems;

  /**
   * Record a reference to the currently highlighted Token.
   * @type {Token|null}
   */
  #highlighted = null;

  /* -------------------------------------------- */
  /* Initialization                               */
  /* -------------------------------------------- */

  /**@inheritdoc */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    applicationOptions.id = applicationOptions.id.replace(
      "{side}",
      options.side,
    );
    return applicationOptions;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Prepares the turn data for the template
   * @returns {Array<{combatant: foundry.documents.Combatant, isCurrent: Boolean, }>}
   */
  prepareTurn() {
    const combat = this.activeCombat;
    if (!combat) return [];

    return combat.turns
      .reduce((acc, combatant, index) => {
        const { isNPC, system } = combatant;
        const { requesting = false, requestOrderIndex = 0 } =
          system?.spotlight ?? {};
        if (isNPC !== this.isPCTracker) {
          acc.push({
            combatant,
            turn: index,
            isCurrent: index === combat.turn,
            isRequesting: requesting,
            spotlightOrder:
              requestOrderIndex === 0 ? Infinity : requestOrderIndex,
            userIsGM: game.user.isGM,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return a.spotlightOrder - b.spotlightOrder;
      });
  }

  /* -------------------------------------------- */
  /* Rendering Lifecycle                          */
  /* -------------------------------------------- */

  /** @override */
  async _renderHTML(_context, _options) {
    return await this._renderTurns();
  }

  /**
   * Internal helper to fetch template and join HTML strings.
   * @returns {Promise<String>}
   * @private
   */
  async _renderTurns() {
    const turns = this.prepareTurn();

    if (turns.length === 0) return "";

    const template = await foundry.applications.handlebars.getTemplate(
      `${SPOTLIGHT_TEMPLATES}/token-combatant.hbs`,
    );

    const options = {
      allowProtoMethodsByDefault: true,
      allowProtoPropertiesByDefault: true,
    };

    return turns.map((turnData) => template(turnData, options)).join("");
  }

  /* -------------------------------------------- */

  /**
   * @override
   * @param {String} result
   * @param {HTMLElement} content
   */
  _replaceHTML(result, content, _options) {
    const state = Flip.getState(content.children);

    const orbitStates = new Map();
    content.querySelectorAll(".request-orbit").forEach((el) => {
      orbitStates.set(el.dataset.orbitId, gsap.getProperty(el, "rotation"));
    });

    content.innerHTML = result;

    const newOrbits = content.querySelectorAll(".request-orbit");
    if (newOrbits.length) {
      gsap.set(newOrbits, {
        rotation: (_, target) => orbitStates.get(target.dataset.orbitId),
      });

      gsap.set(content.querySelectorAll(".request-orbit .satellite"), {
        opacity: 0.8,
        scale: 0.9,
      });
    }

    this.#listItems = content.querySelectorAll(".token-combatant");

    if (!this.#listItems || this.#listItems.length === 0) return;

    Flip.from(state, {
      duration: 0.5,
      ease: "power2.inOut",
      absolute: false,
      scale: true,
      targets: content.children,
      onEnter: (elements) =>
        gsap.fromTo(elements, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      onLeave: (elements) => gsap.to(elements, { opacity: 0, duration: 0.3 }),
    });
  }

  /* -------------------------------------------- */

  /**@override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if (existing) existing.replaceWith(element);
    else {
      const parent =
        document.querySelector(this.options.parent) ?? document.body;
      parent.append(element);

      this.#listItems = element.querySelectorAll(".token-combatant");

      if (this.#listItems.length > 0) {
        gsap.from(this.#listItems, {
          x: this.isPCTracker ? "-5vw" : "5vw",
          opacity: 0,
          stagger: 0.2,
          duration: 1,
          ease: "back.out(1.2)",
        });
      }
    }
  }

  /**@inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);

    if (!this.#listItems || this.#listItems.length === 0) return;

    this._initSpotlightAnimation();
    this._initListItemInteractions();
    this._initOrbitAnimations();

    this.element.addEventListener(
      "pointerover",
      this._onCombatantHoverIn.bind(this),
      { passive: true },
    );
    this.element.addEventListener(
      "pointerout",
      this._onCombatantHoverOut.bind(this),
      { passive: true },
    );
    this.element
      .querySelectorAll('[data-action="combatantClick"')
      .forEach((el) =>
        el.addEventListener("dblclick", this._onCombatantDblClick.bind(this), {
          passive: true,
        }),
      );
  }

  /**
   * Animates the spotlight
   */
  _initSpotlightAnimation() {
    const middleStop = this.element.querySelector(
      "svg.spotlight-svg .stop-middle",
    );
    if (!middleStop) return;

    gsap.to(middleStop, {
      attr: { offset: "50%" },
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }

  /**
   * Sets up hover listeners for the list items
   */
  _initListItemInteractions() {
    this.#listItems.forEach((li) => {
      li.addEventListener("mouseenter", () =>
        gsap.to(li, { scale: 1.2, duration: 0.2 }),
      );
      li.addEventListener("mouseleave", () =>
        gsap.to(li, { scale: 1, duration: 0.2 }),
      );

      const anchor = li.querySelector(".spotlight-anchor");
      if (anchor) {
        const tl = this.#createAnchorHover(anchor);
        li.addEventListener("mouseenter", () => tl.play());
        li.addEventListener("mouseleave", () => tl.reverse());
      }
    });
  }

  /**
   * Handles the isRequesting marker.
   */
  _initOrbitAnimations() {
    const orbits = this.element.querySelectorAll(".request-orbit");
    const satellites = this.element.querySelectorAll(
      ".request-orbit .satellite",
    );

    if (orbits.length) {
      gsap.to(orbits, {
        rotation: "+=360",
        duration: 3,
        repeat: -1,
        ease: "none",
      });
      const tl = gsap.timeline();
      tl.to(satellites, {
        scale: 0.9,
        opacity: 0.8,
        duration: 1.5,
        ease: "back.out(2)",
      }).to(satellites, {
        scale: 1.1,
        opacity: 1,
        duration: 0.7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }
  }

  /**@override */
  async _preClose(options) {
    await super._preClose(options);
    if (!this.#listItems || this.#listItems.length === 0) return;

    await gsap.to(Array.from(this.#listItems).toReversed(), {
      x: this.isPCTracker ? "-5vw" : "5vw",
      opacity: 0,
      stagger: 0.2,
      duration: 1,
      ease: "back.out(1.2)",
    });
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle hovering over a combatant in the tracker.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onCombatantHoverIn(event) {
    const { combatantId } =
      event.target.closest(".token-combatant[data-combatant-id]")?.dataset ??
      {};
    if (!canvas.ready || !combatantId) return;
    const combatant = this.activeCombat.combatants.get(combatantId);
    const token = combatant.token?.object;
    if (token && token._canHover(game.user, event) && token.visible) {
      token._onHoverIn(event, { hoverOutOthers: true });
      this.#highlighted = token;
    }
  }

  /**
   * Handle hovering out a combatant in the tracker.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onCombatantHoverOut(event) {
    this.#highlighted?._onHoverOut(event);
    this.#highlighted = null;
  }

  /**
   * Handle a double click to open the combatant's actor sheet.
   * @param {PointerEvent} event
   * @protected
   */
  _onCombatantDblClick(event) {
    const target = event.target.closest("[data-combatant-id]");
    const { combatantId } = target?.dataset ?? {};
    const combatant = this.activeCombat.combatants.get(combatantId);
    if (!combatant?.actor) return;

    if (combatant.actor.testUserPermission(game.user, "OBSERVER")) {
      combatant.actor.sheet.render(true);
    }
  }

  /**
   * Creates the hover animation timeline for a specific anchor element.
   * @param {HTMLElement} anchor - The DOM element to animate.
   * @returns {gsap.core.Timeline} The paused GSAP timeline.
   */
  #createAnchorHover(anchor) {
    gsap.killTweensOf(anchor);
    gsap.set(anchor, { xPercent: -50, yPercent: -50, x: 0, opacity: 0 });

    const tl = gsap
      .timeline({ paused: true })
      .to(anchor, {
        pointerEvents: "all",
        opacity: 1,
        x: this.isPCTracker ? "80%" : "-80%",
        duration: 0.5,
        ease: "back.out(1.7)",
        zIndex: 5,
      })
      .to(anchor, {
        x: this.isPCTracker ? "+=3" : "-=3",
        duration: 0.1,
        repeat: 5,
        yoyo: true,
        ease: "sin.inOut",
      });

    return tl;
  }

  /**
   * @type {foundry.applications.types.ApplicationClickAction}
   * @this {SpotlightTracker}
   */
  static async #onSetSpotlight(_event, target) {
    const { combatantId } =
      target.closest("[data-combatant-id]")?.dataset ?? {};
    if (!combatantId) return;
    await ui.combat.setCombatantSpotlight(combatantId);
  }

  /**
   * Handle a single click to select and pan to a combatant.
   * @type {foundry.applications.types.ApplicationClickAction}
   * @this {SpotlightTracker}
   */
  static #onCombatantClick(_, target) {
    const { combatantId } =
      target.closest("[data-combatant-id]")?.dataset ?? {};
    const combatant = this.activeCombat.combatants.get(combatantId);

    const token = combatant?.token?.object;
    if (!token) return;

    const controlled = token.control({ releaseOthers: true });
    if (controlled) canvas.animatePan(token.center);
  }

  /**
   * @type {foundry.applications.types.ApplicationClickAction}
   * @this {SpotlightTracker}
   */
  static async #onRequestSpotlight(_, target) {
    const container = target.closest("[data-combatant-id]");
    const combatantId = container?.dataset.combatantId;
    const combatant = this.activeCombat.combatants.get(combatantId);
    if (!combatant) return;

    const isRequesting = !combatant.system.spotlight.requesting;

    let requestOrderIndex = 0;
    if (isRequesting) {
      const turns = this.activeCombat.turns ?? [];
      const maxIndex = turns.reduce(
        (max, c) =>
          !c.isNPC
            ? Math.max(max, c.system.spotlight.requestOrderIndex || 0)
            : max,
        0,
      );
      requestOrderIndex = maxIndex + 1;
    } else {
      const orbit = container.querySelector(".request-orbit");
      if (orbit) {
        await gsap.to(orbit, {
          scale: 0,
          opacity: 0,
          duration: 0.4,
          ease: "back.in(2)",
        });
      }
    }

    await combatant.update({
      "system.spotlight": {
        requesting: isRequesting,
        requestOrderIndex,
      },
    });
  }
}
