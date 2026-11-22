# Voltara Web (Angular 17) — two applications, one workspace

| App | Folder | Dev URL | Purpose |
|---|---|---|---|
| **website** | `projects/website` | http://localhost:4200 | The public company website. Has **no link to the dashboard**. |
| **admin** | `projects/admin` | http://localhost:4201 | The dashboard (login required). Deploy it on its own address, e.g. `admin.yourcompany.com`. |
| shared | `projects/shared` | — | Models, API services, i18n, theme, icons, shared components (imported as `@shared/...`). |

```bash
npm install
npm run start:website     # http://localhost:4200
npm run start:admin       # http://localhost:4201   (run in a second terminal)

npm run build             # dist/website  and  dist/admin   (deploy each one separately)
```

Set the API address in `projects/shared/src/environments/environment.ts` (`apiUrl`), and add the admin
origin to `Cors:AllowedOrigins` in the API (`appsettings.Development.json` already allows `http://localhost:4201`).
For production add both real domains, e.g. `https://www.yourcompany.com` and `https://admin.yourcompany.com`.

Default dev login (seeded by the API): `admin@voltara.com` / `Admin@12345`.

## What changed in this version
See `CHANGES.md`.
