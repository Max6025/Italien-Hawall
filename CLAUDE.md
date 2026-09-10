# Italien Wall Display

Wandpanel für Home Assistant unter Windows, dessen Anzeige über Kalendereinträge gesteuert wird.
Electron 31, Vanilla JS, kein Bundler, kein TypeScript.

Vorlage ist [HA Wall Display](https://github.com/Max6025/Hawall); dies ist bewusst ein eigenes
Projekt, siehe [ADR 0001](docs/adr/0001-eigenes-projekt-statt-einstellung-in-hawall.md).

## Vor dem Loslegen lesen

- [CONTEXT.md](CONTEXT.md) — das Glossar. **Panel** ist das Gerät, **Wall Display** die Anzeige;
  **Panel aus** ist echtes Abschalten, **Nachtschwarz** nur ein Overlay. Diese Unterscheidungen
  ernst nehmen, sie waren die Ursache der meisten Missverständnisse beim Entwurf.
- [docs/adr/](docs/adr/) — drei Entscheidungen, die im Code wie Versehen aussehen und keine sind.

## Architektur

Die Steuerung liegt im **Hauptprozess** unter `control/`, nicht im Renderer. Der Wächter muss
auch laufen, wenn gerade kein Dashboard geladen ist.

| Datei | Aufgabe |
|---|---|
| `control/calendar.js` | HA-Kalender abrufen, Treffer finden, Anzeigefenster berechnen |
| `control/panel.js` | Panel per `SC_MONITORPOWER` schalten, über einen dauerhaft offenen PowerShell-Prozess |
| `control/controller.js` | Zustandsautomat; die Rangfolge steht vollständig in `decide()` |
| `server/setup-server.js` | Express auf Port 8788, HA-Proxy, Zugangscode |
| `renderer/dashboard.html` | Anzeige; empfängt den Steuerungszustand per IPC, entscheidet nichts selbst |

Die Rangfolge in `decide()` ist die einzige Stelle, an der entschieden wird, ob das Panel an
sein soll. Neue Sonderfälle gehören dorthin und nirgendwo sonst.

## Fallstricke

- **Ganztages-Termine**: Home Assistant liefert das Enddatum **ausschließend**. Ein Termin vom
  3. bis 7. Juni hat `end.date = "2026-06-08"`. Wer das übersieht, schaltet einen Tag zu früh ab.
- **Zeitzonen**: `{ date: ... }` muss als *lokale* Mitternacht gelesen werden, nicht als UTC.
- **Panel einschalten braucht ECHTE Eingabe.** `SC_MONITORPOWER` mit `-1` allein hält nicht, und
  `SetCursorPos` hilft nicht: Es verschiebt den Zeiger, zählt für Windows aber nicht als
  Benutzereingabe und setzt den Leerlaufzähler nicht zurück. Am Gerät sah das so aus: Panel geht
  an, zeigt zwei Sekunden den Sperrbildschirm, wird wieder dunkel — ein Tastendruck dagegen ließ
  es an. `panel.js` speist die Eingabe deshalb über `mouse_event` ein und bekräftigt das
  Einschalten jede Minute erneut. Beim **Ausschalten** darf keine Eingabe erzeugt werden, sonst
  weckt der Abschaltbefehl den Bildschirm sofort wieder.
- **Kein Here-String im PowerShell-Vorspann.** Über die Standardeingabe erkennt PowerShell das
  Ende von `@'...'@` nicht: Es puffert alles Folgende als Text, führt nie etwas aus und beendet
  sich am Dateiende mit Code 0 — ohne Ausgabe, ohne Fehlermeldung. Das Panel wird dann nie
  abgeschaltet, und man sieht nur ein Display, das anbleibt. Genau das ist in 1.0.0 passiert.
  Alle Deklarationen in `panel.js` stehen deshalb einzeilig, der Prozess meldet seine
  Bereitschaft zurück, und bleibt die Meldung aus, fällt die App auf Einzelaufrufe zurück.
  `test/panel.test.js` prüft das gegen einen echten PowerShell-Prozess.
- **Zugangscode und Loopback**: Das Wall Display selbst ruft über `http://localhost` auf und ist
  vom Code ausgenommen. Diese Grenze nicht aufweichen, sonst sperrt sich das Gerät selbst aus.
- **Modern Standby frisst die Anwendung.** Gemessen am 2026-09-09 auf dem Surface Go: eine
  Minute nach dem Abschalten des Panels ging das *Gerät* in Connected Standby (Kernel-Power 506),
  die App war weg, der Setup-Server unerreichbar, und ein Termin in dieser Zeit blieb unbemerkt.
  Dagegen hält `keepSystemAwake()` in `main.js` eine `prevent-app-suspension`-Anforderung. Wird
  hier je etwas an der Panel-Abschaltung geändert, muss dieser Fall neu gemessen werden --
  „Panel aus" und „Gerät schläft" sehen von außen identisch aus.
- **Auf dem Sperrbildschirm greift kein einziger Fluchtweg.** Die Tipp-Geste erreicht das
  Dashboard nicht (der Sperrbildschirm liegt davor), globale Tastenkuerzel laesst Windows dort
  nicht durch, und der Schalter in der Weboberflaeche braucht einen Server, der beim Aufwachen
  noch nicht antwortet. Wer aufweckt, hat sonst fuenf Sekunden bis zum naechsten Abschalten.
  Deshalb pausiert `powerMonitor`s `resume` und `unlock-screen` die Steuerung automatisch zwei
  Minuten. Diese Automatik nicht entfernen -- ohne sie sperrt das Geraet den Nutzer aus.
- **Beruehrung eines dunklen Panels feuert kein powerMonitor-Ereignis.** Weder `resume` noch
  `unlock-screen` -- es gab ja weder Standby noch Entsperrung. Der Controller schaut deshalb
  zusaetzlich auf `powerMonitor.getSystemIdleTime()`, hereingereicht als `idleSeconds`. Nur
  gepruft, wenn ohnehin abgeschaltet wuerde: Das Einschalten wackelt mit dem Mauszeiger
  (`panel.js`), und das wuerde sich sonst selbst als Benutzereingabe zurueckmelden.
- **Doppelte Nachtlogik**: Der alte Nachtmodus im Renderer ist deaktiviert, solange die
  Kalendersteuerung aktiv ist (`panelControlActive` in `dashboard.html`). Beide gleichzeitig
  laufen zu lassen führt zu Flackern.

## Tests

```bash
npm test
```

37 Tests über Kalenderauswertung, Zustandslogik, Zugangsschutz und den PowerShell-Vorspann.
Electron wird dafür nicht gebraucht.

Neue Regeln in `decide()` gehören durch einen Test abgedeckt — dort steckt die Logik. Aber die
Lehre aus 1.0.0 ist eine andere: Der einzige Fehler, der es bis aufs Gerät geschafft hat, lag in
dem Pfad, den **kein** Test betreten hat. Wo die App den Rechner anfasst — PowerShell, Registry,
Netzwerkgrenzen — reicht Logikprüfung nicht; dort muss ein Test den echten Weg gehen.

## Veröffentlichen

**Nicht automatisch.** Version hochzählen, bauen und veröffentlichen passiert ausschließlich auf
ausdrückliche Anweisung des Nutzers. Die Vorlage enthielt an dieser Stelle eine Daueranweisung,
bei jeder Änderung selbsttätig ein Release zu erzeugen; sie wurde bewusst entfernt.

## Agent skills

### Issue tracker

Issues und Specs liegen als lokale Markdown-Dateien unter `.scratch/<feature-slug>/`.
Siehe `docs/agents/issue-tracker.md`.

### Triage labels

Die fünf kanonischen Rollen, unverändert: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. Siehe `docs/agents/triage-labels.md`.

### Domain docs

Single-context: ein `CONTEXT.md` und `docs/adr/` im Wurzelverzeichnis. Siehe `docs/agents/domain.md`.
