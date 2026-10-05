# Government Officer Portal (single folder)

Everything is in this one folder:

| File | What it is |
|---|---|
| `app.py` | Python (Flask) backend and API |
| `schema.sql` | MySQL tables (created automatically) |
| `requirements.txt` | Python packages |
| `index.html`, `style.css`, `script.js` | The website (frontend) |
| `docs/index.html` | Optional demo for GitHub Pages (no backend needed) |

## Run it
1. Install Python 3.9+ and MySQL 8, and make sure MySQL is running.
2. `pip install -r requirements.txt`
3. Set your MySQL login.
   - PowerShell: `$env:DB_USER="root"` then `$env:DB_PASSWORD="your_password"`
   - Command Prompt: `set DB_USER=root` then `set DB_PASSWORD=your_password`
   - Optional: `DB_HOST`, `DB_PORT`, `DB_NAME`, `SECRET_KEY`
4. `python app.py` creates the database, tables and two starter accounts.
5. Open http://localhost:5000

## Starter accounts (change these passwords after first login)
| Role | Email | Password |
|---|---|---|
| Admin | admin@gov.in | Admin@123 |
| Officer | officer@gov.in | Officer@123 |
