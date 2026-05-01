# 🍅 Tomaten-Archiv – Komplette Setup-Anleitung

Schritt für Schritt von Null bis zur fertigen, öffentlich erreichbaren App.
Keine Programmierkenntnisse nötig – folge einfach der Reihenfolge.

---

## Schritt 1: Supabase einrichten (Backend & Datenbank)

Supabase ist dein kostenloser Server. Hier werden alle Daten, Nutzer und Bilder gespeichert.

### 1.1 Konto erstellen
1. Gehe auf **https://supabase.com**
2. Klicke „Start your project" → „Sign up" (kostenlos)
3. Melde dich mit GitHub oder E-Mail an

### 1.2 Neues Projekt anlegen
1. Klicke „New Project"
2. Name: `tomaten-archiv` (oder beliebig)
3. Datenbank-Passwort: ein sicheres Passwort wählen und **notieren**
4. Region: `Central EU (Frankfurt)` → **Save**
5. Warten bis das Projekt fertig ist (ca. 1–2 Minuten)

### 1.3 Datenbank aufsetzen
1. Im linken Menü: **SQL Editor** klicken
2. Klicke „New Query"
3. Öffne die Datei `supabase-setup.sql` aus dem Projektordner
4. Kopiere den gesamten Inhalt und füge ihn ins SQL-Editor-Fenster ein
5. Klicke **Run** (▶️) – alle Tabellen und Zugriffsregeln werden erstellt

### 1.4 API-Schlüssel kopieren
1. Im linken Menü: **Project Settings** → **API**
2. Notiere dir:
   - **Project URL** (sieht aus wie `https://xxxxxx.supabase.co`)
   - **anon public** Key (langer Text unter „Project API keys")

---

## Schritt 2: App lokal starten

### 2.1 Node.js installieren (einmalig)
Falls noch nicht installiert: **https://nodejs.org** → „LTS" Version herunterladen und installieren.

### 2.2 Projektdateien einrichten
1. Entpacke den heruntergeladenen ZIP-Ordner `tomaten-app`
2. Öffne den Ordner in einem Terminal:
   - **Windows**: Rechtsklick im Ordner → „In Terminal öffnen"
   - **Mac**: Rechtsklick → „Neues Terminal im Ordner"

### 2.3 Umgebungsvariablen setzen
1. Kopiere die Datei `.env.example` und benenne sie um zu `.env`
2. Öffne `.env` mit einem Texteditor (z.B. Notepad)
3. Ersetze die Platzhalter mit deinen Supabase-Werten:

```
VITE_SUPABASE_URL=https://DEINE-PROJEKT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key-hier
```

### 2.4 App starten
Führe im Terminal nacheinander aus:

```bash
npm install
npm run dev
```

Öffne dann **http://localhost:5173** im Browser – die App läuft!

### 2.5 Ersten Admin-Account erstellen
1. In der App: „Registrieren" wählen
2. Name, E-Mail und Passwort eingeben
3. E-Mail bestätigen (Supabase schickt eine Mail)
4. In Supabase: **Table Editor** → Tabelle `profiles` öffnen
5. Deine Zeile suchen → Spalte `role` auf `admin` setzen
6. Du bist jetzt Admin und kannst andere Nutzer verwalten

---

## Schritt 3: App online stellen (Vercel)

### 3.1 GitHub-Konto erstellen
Gehe auf **https://github.com** und erstelle ein kostenloses Konto.

### 3.2 Code auf GitHub laden
Im Terminal (im Projektordner):

```bash
git init
git add .
git commit -m "Tomaten-Archiv initial"
```

Dann auf GitHub:
1. Klicke „New repository"
2. Name: `tomaten-archiv`
3. Klicke „Create repository"
4. Kopiere die angezeigten Befehle (`git remote add origin…`) und führe sie im Terminal aus

### 3.3 Vercel-Konto & Deployment
1. Gehe auf **https://vercel.com** → „Sign up" mit GitHub-Konto
2. Klicke „Add New Project"
3. Wähle dein `tomaten-archiv` Repository → „Import"
4. **Wichtig – Umgebungsvariablen eintragen:**
   - Klicke „Environment Variables"
   - Variable 1: Name `VITE_SUPABASE_URL`, Wert: deine Supabase-URL
   - Variable 2: Name `VITE_SUPABASE_ANON_KEY`, Wert: dein anon-Key
5. Klicke „Deploy"
6. Nach 1–2 Minuten bekommst du eine URL wie `tomaten-archiv.vercel.app`

**Deine App ist jetzt online! 🎉**

---

## Schritt 4: Andere Nutzer einladen

Teile einfach deine Vercel-URL mit den anderen Gärtnern.
Sie können sich selbst registrieren. Als Admin kannst du im Bereich „Nutzer" die Rollen verwalten.

### E-Mail-Bestätigung deaktivieren (optional)
Wenn die Nutzer keine Bestätigungs-Mail bekommen sollen:
1. Supabase → **Authentication** → **Settings**
2. „Enable email confirmations" → **ausschalten**
3. Save

---

## Schritt 5: Eigene Domain (optional)

Statt `tomaten-archiv.vercel.app` kannst du eine eigene Domain verwenden:
- Domains gibt es z.B. bei **Namecheap** oder **IONOS** ab ca. 10 €/Jahr
- In Vercel: Projekteinstellungen → „Domains" → Domain eintragen → DNS-Einträge setzen

---

## Kosten

| Dienst   | Kostenlos bis…                          |
|----------|-----------------------------------------|
| Supabase | 500 MB Datenbank, 1 GB Bilder, 50k Nutzer |
| Vercel   | Unbegrenzte Deployments (kleine Projekte) |
| GitHub   | Kostenlos für öffentliche & private Repos |

Für euer Projekt reicht der kostenlose Tarif problemlos aus.

---

## Häufige Probleme

**„Supabase-Umgebungsvariablen fehlen"**
→ `.env`-Datei prüfen, Leerzeichen vor/nach `=` entfernen

**Registrierung funktioniert, aber Login nicht**
→ E-Mail-Bestätigung in Supabase deaktivieren (siehe Schritt 4)

**Bilder werden nicht gespeichert**
→ In Supabase prüfen: Storage → Bucket `tomato-images` muss existieren und öffentlich sein

**Änderungen werden nicht angezeigt**
→ Nach Code-Änderungen: `git add . && git commit -m "Update" && git push` – Vercel deployed automatisch

---

## Zusammenfassung der Dateien

```
tomaten-app/
├── src/
│   ├── main.jsx          ← React-Einstiegspunkt
│   ├── App.jsx           ← Gesamte App-Logik
│   └── supabase.js       ← Datenbankverbindung
├── index.html            ← HTML-Grundgerüst
├── vite.config.js        ← Build-Konfiguration
├── package.json          ← Abhängigkeiten
├── .env.example          ← Vorlage für Zugangsdaten
├── .gitignore            ← Git ignoriert .env
├── supabase-setup.sql    ← Datenbankschema
└── ANLEITUNG.md          ← Diese Datei
```
