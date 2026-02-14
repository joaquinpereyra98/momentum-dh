export default function onUpdateCombat(combat) {
  if(combat === game.combat) momentum.apps.SpotlightTracker.renderAll({force: true});
}
