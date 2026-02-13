import { db, sqlite } from '../db/index';
import { patients, clinicalNotes } from '../db/schema';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🌱 Sembrando base de datos local (SQLite)...');

  try {
    const id = randomUUID();
    db.insert(patients).values({
      id,
      fullName: 'Juan Camilo Pérez',
      birthDate: '1995-05-15',
      phone: '+57 300 123 4567',
      type: 'PSY',
      photoUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36',
      tags: JSON.stringify(['Ansiedad', 'Nuevo']),
      active: 1,
      createdAt: new Date().toISOString()
    }).run();

    db.insert(clinicalNotes).values({
      id: randomUUID(),
      patientId: id,
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Primera nota de prueba. ✅' }] }]
      }),
      mood: '🙂',
      attachments: JSON.stringify([]),
      createdAt: new Date().toISOString()
    }).run();

    console.log('✅ Seed listo');
    console.log(`➡️  Abre: http://localhost:3000/patient/${id}`);
  } catch (e) {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  } finally {
    // Close sqlite file handle (important on Windows)
    sqlite.close();
  }
}

main();
