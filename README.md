# PsyCloud (Local, SQLite)

Esta versión está hecha para que **funcione apenas la descargas**, sin Postgres ni Supabase.

## Requisitos
- Node.js 18+ (ideal 20+)

## Pasos (Windows)
1. Descomprime el ZIP
2. Abre una terminal en la carpeta del proyecto (donde está `package.json`)
3. Instala dependencias:
   ```bash
   npm install
   ```
4. Crea data de prueba:
   ```bash
   npm run seed
   ```
5. Arranca:
   ```bash
   npm run dev
   ```
6. Abre: http://localhost:3000

## Seguridad (login)
Esta versión **requiere inicio de sesión**.

1) Copia `.env.example` a `.env.local` y define un secreto:

```env
AUTH_SECRET=pon-un-secreto-largo-aqui
```

2) La primera vez, abre la app y te llevará a **/setup** para crear el usuario admin.

## Uploads (local)
Los archivos se guardan en `public/uploads` y quedan disponibles con URL `/uploads/...`.




---

# Modo Desktop (Instalable + actualizable)

Este repo también incluye un wrapper **Electron** para convertir PsyCloud en una app de escritorio (Windows/macOS/Linux).

## Ejecutar en modo escritorio (desarrollo)
```bash
npm install
npm run dev
```

## Construir instaladores
```bash
npm run build
```

Los instaladores se generan en la carpeta `dist/`.

## Dónde queda la “memoria” (datos locales)
En modo Desktop, la base de datos SQLite y los uploads se guardan en la carpeta del usuario del sistema (Electron `userData`), por ejemplo:

- Windows: `C:\Users\<tu_usuario>\AppData\Roaming\PsyCloud\`
- macOS: `~/Library/Application Support/PsyCloud/`
- Linux: `~/.config/PsyCloud/`

## Actualizaciones automáticas
El proyecto está configurado para publicar releases en GitHub (electron-builder `publish: github`).
Para que funcione el auto-update debes:
1) crear un repo en GitHub
2) configurar el publish en tu pipeline de releases
3) firmar/notarizar en macOS (recomendado)

Si no quieres GitHub, se puede cambiar a S3 o un servidor propio (“generic provider”).
