import fs from 'fs';
import path from 'path';

console.log('PsyCloud Doctor 🩺');
console.log('1) Si ves ECONNREFUSED 127.0.0.1:5432, eso es Postgres. Esta versión usa SQLite y NO debe intentar conectar a 5432.');
console.log('2) Asegúrate de estar corriendo desde esta carpeta (donde está package.json).');

const db = path.resolve(process.cwd(), 'psycloud.db');
console.log('DB esperada:', db, fs.existsSync(db) ? '(existe)' : '(no existe aún)');
