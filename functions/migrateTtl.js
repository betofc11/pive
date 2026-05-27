const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const firebaseConfig = require('../firebase-applet-config.json');

// Initialize Admin SDK
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

// Access custom or default firestore database
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId)
  : getFirestore();

async function migrate() {
  console.log("Iniciando migración de dailyLogs...");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  console.log(`Fecha de expiración configurada para: ${tomorrow.toISOString()}`);

  // Fetch all documents from 'dailyLogs' subcollections
  const snapshot = await db.collectionGroup('dailyLogs').get();
  console.log(`Se encontraron ${snapshot.size} registros en total.`);

  let updatedCount = 0;
  let batch = db.batch();
  const batchSize = 400;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.expireAt) {
      batch.update(doc.ref, { expireAt: admin.firestore.Timestamp.fromDate(tomorrow) });
      updatedCount++;

      if (updatedCount % batchSize === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Progreso: ${updatedCount} documentos actualizados...`);
      }
    }
  }

  if (updatedCount % batchSize !== 0) {
    await batch.commit();
  }

  console.log(`Migración completada con éxito. ${updatedCount} registros actualizados para expirar mañana.`);
}

migrate().catch((err) => {
  console.error("Error durante la migración:", err);
  console.log("\nSi obtienes un error de credenciales, asegúrate de haber iniciado sesión ejecutando:");
  console.log("gcloud auth application-default login");
});
