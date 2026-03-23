import { MODULE_ID, TEMPLATES_PATH } from "../constants.mjs";

const { ApplicationV2 } = foundry.applications.api;

const SPOTLIGHT_TEMPLATES = `${TEMPLATES_PATH}/spotlight-tracker`;

/**
 * @typedef {Object} EtheriaTurn
 * @property {Combatant} combatant       - The specific Combatant document.
 * @property {number} turn               - The original index of the combatant in the combat.turns array.
 * @property {boolean} isRequesting      - Whether the combatant is currently requesting the spotlight.
 * @property {number} spotlightOrder     - The priority order for the spotlight (defaults to Infinity).
 * @property {boolean} userIsGM          - Whether the current user viewing the tracker is a GM.
 * @property {string} cssClass           - A string of CSS classes (e.g., "invisible", "defeated").
 */

/** The Spotlight Tracker */
export default class SpotlightTracker extends ApplicationV2 {
  /* -------------------------------------------- */
  /* Static Properties & Methods                  */
  /* -------------------------------------------- */

  /** @type {foundry.applications.types.ApplicationConfiguration} */
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-spotlight-tracker-{side}`,
    tag: "div",
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

  get isPCTracker() {
    return this.options.side === "left";
  }

  /**@type {HTMLLIElement[]} */
  #listItems = [];

  /**@type {HTMLDivElement|null} */
  #activeItem = null;

  /**@type {HTMLElement[]} */
  get #allItems() {
    return [this.#activeItem, ...this.#listItems].filter(Boolean);
  }

  /**
   * Record a reference to the currently highlighted Token.
   * @type {Token|null}
   */
  #highlighted = null;

  /**
   *
   * Returns the width of a token list item in pixels.
   * @type {number}
   */
  get tokenSize() {
    /**@type {HTMLElement} */
    const el = this.element?.querySelector(".token-combatant:not(.active)");
    if (!el) return 65;
    return el.offsetHeight;
  }

  /**
   * The current vertical position in pixels.
   * @type {Number}
   */
  #currentY = 0;

  /**
   * The IntersectionObserver instance managing visibility logic for list items.
   * @type {Observer}
   * @private
   */
  #observer;

  get #visibleCount() {
    const container = this.element?.querySelector("div.list-container");
    if (!container) return 5;
    const containerHeight = container.clientHeight;
    return Math.max(1, Math.floor(containerHeight / this.tokenSize));
  }

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
   * @returns {{current: EtheriaTurn|null, turns: EtheriaTurn[]}}
   */
  prepareTurns() {
    const combat = game.combat;
    if (!combat) return { current: null, turns: [] };
    const allTurns = combat.turns.reduce((acc, combatant, index) => {
      if (combatant.isNPC === this.isPCTracker || !combatant.visible)
        return acc;

      const { requesting = false, requestOrderIndex = 0 } =
        combatant.system?.spotlight ?? {};

      const classes = [];
      if (combatant.hidden) classes.push("invisible");
      if (combatant.isDefeated) classes.push("defeated");

      acc.push({
        combatant,
        turn: index,
        isRequesting: requesting,
        spotlightOrder: requestOrderIndex || Infinity,
        userIsGM: game.user.isGM,
        cssClass: classes.join(" "),
      });

      return acc;
    }, []);

    const current = allTurns.find((t) => t.turn === combat.turn);
    const others = allTurns
      .filter((t) => t.turn !== combat.turn)
      .sort((a, b) => a.spotlightOrder - b.spotlightOrder);
    return {
      current,
      turns: others,
    };
  }

  /* -------------------------------------------- */
  /* Rendering Lifecycle                          */
  /* -------------------------------------------- */

  /** @override */
  async _renderHTML(_context, _options) {
    const { current, turns } = this.prepareTurns();
    if (turns.length === 0) return "";
    const template = await foundry.applications.handlebars.getTemplate(
      `${SPOTLIGHT_TEMPLATES}/token-combatant.hbs`,
    );
    const options = {
      allowProtoMethodsByDefault: true,
      allowProtoPropertiesByDefault: true,
    };

    const turnsHtml = turns
      .map((turnData) => template(turnData, options))
      .join("");

    return await foundry.applications.handlebars.renderTemplate(
      `${SPOTLIGHT_TEMPLATES}/tracker.hbs`,
      { turns: turnsHtml, current },
    );
  }

  /* -------------------------------------------- */

  /**
   * @override
   * @param {String} result
   * @param {HTMLElement} content
   */
  _replaceHTML(result, content, _options) {
    const state = Flip.getState(content.querySelectorAll(".token-combatant"));

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
    }

    this.#listItems =
      Array.from(content.querySelectorAll("li.token-combatant")) ?? [];
    this.#activeItem = content.querySelector("div.token-combatant.active");

    if (this.#allItems.length === 0) return;

    Flip.from(state, {
      duration: 0.5,
      ease: "power2.inOut",
      absolute: false,
      scale: true,
      targets: this.#allItems,
      onEnter: (elements) =>
        gsap.fromTo(elements, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      onLeave: (elements) => gsap.to(elements, { opacity: 0, duration: 0.3 }),
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    const parent = document.querySelector(this.options.parent) ?? document.body;

    if (existing) {
      existing.replaceWith(element);
    } else {
      parent.append(element);
    }

    const getOpacity = (i) => {
      const diff = i - Math.round(Math.abs(this.#currentY) / this.tokenSize);
      if (diff >= 0 && diff < this.#visibleCount) return 1;
      return diff === this.#visibleCount ? 0.3 : 0;
    };

    if (existing) return gsap.set(this.#listItems, { opacity: getOpacity });

    const xOffset = this.isPCTracker ? "-5vw" : "5vw";
    const tl = gsap.timeline({
      defaults: { duration: 0.5, ease: "back.out(1.2)" },
    });

    if (this.#activeItem) {
      tl.from(this.#activeItem, { x: xOffset, opacity: 0 });
    }

    tl.fromTo(
      this.#listItems,
      { x: xOffset, opacity: 0 },
      { x: 0, opacity: getOpacity, stagger: 0.2 },
      "-=0.2",
    );
  }

  /**@inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);

    if (this.#allItems.length === 0) return;

    this._initListItemInteractions();
    this._initOrbitAnimations();
    this._initVirtualScroll();

    this.element.addEventListener(
      "pointerover",
      (e) => this._onCombatantHover(e, true),
      { passive: true },
    );
    this.element.addEventListener(
      "pointerout",
      (e) => this._onCombatantHover(e, false),
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

  _initVirtualScroll() {
    const container = this.element.querySelector("div.list-container");
    const ul = container.querySelector("ul.turns-list");
    const totalItems = ul.querySelectorAll("li.token-combatant")?.length;

    const maxScroll = Math.max(
      0,
      (totalItems - this.#visibleCount) * this.tokenSize,
    );

    this.#currentY = this.#currentY || 0;
    this.#observer?.kill();

    const handleMove = ({ deltaY }) => {
      const direction = Math.sign(deltaY);
      const nextY = Math.clamp(
        this.#currentY + direction * this.tokenSize,
        -maxScroll,
        0,
      );

      if (nextY === this.#currentY) return;
      this.#currentY = nextY;

      gsap.to(ul, {
        y: this.#currentY,
        duration: 0.4,
        ease: "power2.out",
        onUpdate: this._refreshVisibility.bind(this),
      });
    };

    this.#observer = Observer.create({
      target: container,
      type: "wheel,touch,pointer",
      onUp: handleMove,
      onDown: handleMove,
      wheelSpeed: -1,
      preventDefault: true,
      tolerance: 20,
    });
  }

  _refreshVisibility() {
    const liElements = this.element.querySelectorAll(
      "ul.turns-list li.token-combatant",
    );
    const itemSize = this.tokenSize;
    const visibleCount = this.#visibleCount;
    const activeIdx = Math.round(Math.abs(this.#currentY) / itemSize);
    const isVisible = (diff) => diff >= 0 && diff < visibleCount;
    const isPeek = (diff) => diff === visibleCount;

    gsap.to(liElements, {
      opacity: (i) =>
        isVisible(i - activeIdx) ? 1 : isPeek(i - activeIdx) ? 0.3 : 0,
      pointerEvents: (i) => (isVisible(i - activeIdx) ? "auto" : "none"),
      duration: 0.3,
    });
  }

  /**
   * Sets up hover listeners for the list items
   */
  _initListItemInteractions() {
    this.element
      .querySelectorAll("ul.turns-list li.token-combatant")
      .forEach((li) => {
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
    if (orbits.length) {
      gsap.to(orbits, {
        rotation: "+=360",
        duration: 3,
        repeat: -1,
        ease: "none",
      });
    }
  }

  /**@override */
  async _preClose(options) {
    await super._preClose(options);
    if (this.#allItems.length === 0) return;

    await gsap.to(this.#allItems.toReversed(), {
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
   * Handle hovering in/out a combatant in the tracker.
   * @param {PointerEvent} event  The triggering event.
   * @param {boolean} hoverIn     Whether we are hovering in.
   */
  _onCombatantHover(event, hoverIn) {
    if (!hoverIn) {
      this.#highlighted?._onHoverOut(event);
      this.#highlighted = null;
      return;
    }
    const { combatantId } =
      event.target.closest(".token-combatant[data-combatant-id]")?.dataset ??
      {};
    if (!canvas.ready || !combatantId) return;
    const token = game.combat?.combatants.get(combatantId)?.token?.object;
    if (token && token._canHover(game.user, event) && token.visible) {
      token._onHoverIn(event, { hoverOutOthers: true });
      this.#highlighted = token;
    }
  }

  /**
   * Handle a double click to open the combatant's actor sheet.
   * @param {PointerEvent} event
   */
  _onCombatantDblClick(event) {
    const target = event.target.closest("[data-combatant-id]");
    const { combatantId } = target?.dataset ?? {};
    const combatant = game.combat.combatants.get(combatantId);
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
    gsap.set(anchor, {
      opacity: 0,
    });

    const tl = gsap
      .timeline({ paused: true })
      .to(anchor, {
        pointerEvents: "all",
        opacity: 1,
        xPercent: this.isPCTracker ? 100 : -100,
        duration: 0.5,
        ease: "ease.in",
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
    const combatant = game.combat.combatants.get(combatantId);

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
    const combatant = game.combat.combatants.get(combatantId);
    if (!combatant) return;

    const isRequesting = !combatant.system.spotlight.requesting;

    let requestOrderIndex = 0;
    if (isRequesting) {
      const turns = game.combat.turns ?? [];
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
