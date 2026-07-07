# RAIN SMP — edit server files in Cursor

Sync folder: `C:\Users\ksyed\Documents\RAIN SMP Server Sync`

---

## SFTP login failing?

`Permission denied (password)` = PebbleHost rejected the username/password pair.

### Step 1 — confirm the password in your browser

1. Open your **PebbleHost game server panel** (where you manage this Bedrock server).
2. Log out, then log back in with the password you think is correct.
3. If login fails → reset the **panel password** there (not billing unless they are the same for you).

### Step 2 — use PebbleHost’s built-in SFTP button

In the panel, click **Launch SFTP** (same place as SFTP Details).

- If WinSCP/FileZilla opens and connects → your password **is** correct; run `test-sftp.bat` again and paste the password carefully.
- If Launch SFTP also fails → reset panel password, then retry.

### Step 3 — run the test script

Double-click **`test-sftp.bat`** → enter password at `Panel password:`

Use **copy/paste** from your password manager (no extra spaces).

### Step 4 — manual download (FileZilla)

If scripts still fail but Launch SFTP works:

| Field | Value |
|-------|--------|
| Protocol | **SFTP** |
| Host | `na2041.pebblehost.net` |
| Port | `2222` |
| User | `ksyed1324@gmail.com.588b5a1a` |
| Password | Panel password |

Download these folders to `C:\Users\ksyed\Documents\RAIN SMP Server Sync\`:

- `/behavior_packs`
- `/resource_packs`

---

## Deploy changes to the Bedrock server

Local file edits do **not** reach PebbleHost until you deploy them.

### One-time setup

1. Double-click **`.vscode/setup-sftp.bat`**
2. Enter your **PebbleHost panel password**

This saves credentials and enables **upload on save** in Cursor.

### Push updates

| Goal | Run |
|------|-----|
| Fix API manifests (`2.9.0-beta`) | **`.vscode/deploy.bat`** or `cd .vscode && npm run deploy:manifests` |
| Full RAIN SMP addon update | `cd .vscode && npm run deploy:rain` |
| Essentials pack | `cd .vscode && npm run deploy:essentials` |
| More Hotbars RP | `cd .vscode && npm run deploy:hotbars` |
| Paradox AntiCheat | `cd .vscode && npm run deploy:paradox` |

Managed packs list: `.vscode/managed-packs.json` · Pull from server: `npm run download:paradox` (or `download:packs` for all)

After deploy, **restart the server** from the PebbleHost panel.

---

## After files are downloaded

Open the sync folder in Cursor. With setup complete, saving a file auto-uploads it.

Config: `.vscode\sftp.json` · Credentials: `.vscode\sftp.secrets.json` (local only)
