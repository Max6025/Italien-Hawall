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
- **Panel einschalten**: `SC_MONITORPOWER` mit `-1` ist auf aktuellem Windows unzuverlässig.
  Zuverlässig weckt nur echte Eingabe — deshalb der Mauszeiger-Wackler in `panel.js`.
- **Zugangscode und Loopback**: Das Wall Display selbst ruft über `http://localhost` auf und ist
  vom Code ausgenommen. Diese Grenze nicht aufweichen, sonst sperrt sich das Gerät selbst aus.
- **Doppelte Nachtlogik**: Der alte Nachtmodus im Renderer ist deaktiviert, solange die
  Kalendersteuerung aktiv ist (`panelControlActive` in `dashboard.html`). Beide gleichzeitig
  laufen zu lassen führt zu Flackern.

## Tests

```bash
npm test
```

24 Tests über Kalenderauswertung und Zustandslogik, ohne Electron. Neue Regeln in `decide()`
gehören durch einen Test abgedeckt — dort steckt die gesamte Fehleranfälligkeit des Projekts.

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
