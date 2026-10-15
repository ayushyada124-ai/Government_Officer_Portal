# Government Officer Portal

Admin and Officer logins, each with its own dashboard.
Python (Flask) backend, MySQL database, HTML/CSS/JavaScript frontend.

## Folder
| File | What it is |
|---|---|
| `app.py` | Python backend and API |
| `schema.sql` | MySQL tables (created automatically) |
| `requirements.txt` | Python packages |
| `Procfile` | Start command for Render, Railway and similar hosts |
| `public/` | The website: `index.html`, `style.css`, `script.js` |
| `docs/index.html` | Optional demo for GitHub Pages (no backend needed) |

## Settings (environment variables)
| Name | Meaning | Default |
|---|---|---|
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_USER` | MySQL user | root |
| `DB_PASSWORD` | MySQL password | (empty) |
| `DB_NAME` | Database name (must already exist on a cloud host) | gov_portal |
| `SECRET_KEY` | Long random text used to sign logins | change-this-secret |

Never write real passwords inside the code or on GitHub. Set them as environment variables.

## Run on your computer
1. Install Python 3.9+ and MySQL 8, and start MySQL.
2. `pip install -r requirements.txt`
3. PowerShell: `$env:DB_USER="root"` and `$env:DB_PASSWORD="your_password"` (Command Prompt: `set DB_USER=root`, `set DB_PASSWORD=your_password`)
4. `python app.py` then open http://localhost:5000

## Put it on GitHub
Create a repository, then upload the contents of this folder (the files themselves, not the zip) with **Add file > Upload files**, or use `git add -A`, `git commit`, `git push`.

## Deploy online (needs a MySQL database that is reachable from the internet)
A MySQL on your own laptop cannot be reached by a hosting service. Create a cloud MySQL first, note its host, port, user, password and database name, and create the (empty) database in the provider's dashboard.

### Vercel
1. vercel.com > Add New > Project > import the GitHub repository (Vercel detects Flask by itself).
2. Settings > Environment Variables: add `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SECRET_KEY`.
3. Deploy. Tables and the two starter accounts are created on the first sign-in attempt.

### Render (or Railway)
1. New > Web Service > connect the GitHub repository.
2. Build command: `pip install -r requirements.txt`   Start command: `gunicorn app:app`
3. Add the same environment variables, then deploy.

## Starter accounts (change these passwords after the first login)
| Role | Email | Password |
|---|---|---|
| Admin | admin@gov.in | Admin@123 |
| Officer | officer@gov.in | Officer@123 |
