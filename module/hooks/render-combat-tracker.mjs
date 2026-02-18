/**
 * A hook event that fires whenever the CombatTracker is rendered.
 * @param {ApplicationV2} application - The Application instance being rendered
 * @param {HTMLElement} element - The inner HTML of the document that will be displayed and may be modified
 * @param {ApplicationRenderContext} context - The application rendering context data
 * @param {ApplicationRenderOptions} options - The application rendering options
 */
export default function onRenderCombatTracker(_, element) {
  const nav = element.querySelector("nav.encounters");
  if (!nav) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "inline-control icon fa-solid fa-axe-battle";
  btn.dataset.tooltip = "Open Momentum Tracker";
  btn.ariaLabel = "Open Momentum Tracker";

  nav.insertAdjacentElement("beforeend", btn);

  btn.addEventListener("click", () => {
    const isRendered = momentum.apps.SpotlightTracker.isRendered;
    if (!isRendered) momentum.apps.SpotlightTracker.renderAll({ force: true });
    else momentum.apps.SpotlightTracker.closeAll();
  });
}
