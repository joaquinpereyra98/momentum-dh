
/**
 * 
 * @param {foundry.documents.Combat} combat - The existing Document which was deleted
 * @param {Partial<foundry.abstract.types.DatabaseDeleteOperation>} options - Additional options which modified the deletion request
 * @param {string} userId - The ID of the User who triggered the deletion workflow
 */
export default function onDeleteCombat() {
  if(!game.combat) momentum.apps.SpotlightTracker.closeAll();
  else {
    momentum.apps.SpotlightTracker.renderAll()
  }
}