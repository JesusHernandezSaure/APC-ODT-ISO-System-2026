
import { db } from './firebase';
import { ref, get, update } from 'firebase/database';

export const migrateComments = async (dryRun: boolean = true) => {
  console.log(`Starting migration... (dryRun: ${dryRun})`);
  const snap = await get(ref(db, 'project_details'));
  const data = snap.val();
  const updates: Record<string, any> = {};
  
  if (!data) return;

  for (const id in data) {
    if (data[id].comentarios) {
      updates[`project_comments/${id}`] = data[id].comentarios;
    }
  }
  
  if (dryRun) {
    console.log("Dry run updates:", updates);
    alert("Dry run completado. Revisa la consola.");
  } else {
    await update(ref(db), updates);
    console.log("Migration complete");
    alert("Migración completada.");
  }
};
