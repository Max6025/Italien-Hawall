# Italien Wall Display

Wandpanel für Home Assistant unter Windows, dessen Anzeige über Kalendereinträge gesteuert wird.
Electron 31, Vanilla JS, kein Bundler, kein TypeScript.

Vorlage ist [HA Wall Display](https://github.com/Max6025/Hawall); dies ist bewusst ein eigenes
Projekt, siehe [ADR 0001](docs/adr/0001-eigenes-projekt-statt-einstellung-in-hawall.md).

## Vor dem Loslegen lesen

- [CONTEXT.md](CONTEXT.md) — das Glossar. **Panel** ist das Gerät, **Wall Display** die Anzeige;
  **Panel aus** ist echtes Abschalten, **Nachtschwarz** nur ein Overlay. Diese Unterscheidungen
  ernst nehmen, sie waren die Ursache der meisten Missverständnisse beim Entwurf.
- [docs/adr/](docs/adr/) — vier Entscheidungen, die im Code wie Versehen aussehen und keine sind.

## Architektur

Die Steuerung liegt im **Hauptprozess** unter `control/`, nicht im Renderer. Der Wächter muss
auch laufen, wenn gerade kein Dashboard geladen ist.

| Datei | Aufgabe |
|---|---|
| `control/calendar.js` | HA-Kalender abrufen, Treffer finden, Anzeigefenster berechnen |
| `control/panel.js` | Panel per `SC_MONITORPOWER` schalten, über einen dauerhaft offenen PowerShell-Prozess |
| `control/controller.js` | Zustandsautomat; die Rangfolge steht vollständig in `decide()` |
| `server/setup-server.js` | Express auf Port 8788, HA-Proxy, Zugangscode |
| `server/dashboard-austausch.js` | Dashboards als Datei aus- und eingeben; Prüfung beim Import |
| `renderer/dashboard.html` | Anzeige; empfängt den Steuerungszustand per IPC, entscheidet nichts selbst |
| `renderer/shared/ankunftsschirm.js` | Ankunftsschirm: `sollAnzeigen()` ist reine Entscheidung ohne DOM und ohne Uhr, der Rest ist Anzeige |
| `renderer/shared/dashboard-render.js` | Kartenkatalog und Rendering; enthält auch das eingebaute Design `DEFAULT_THEME` |

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
- **Rundruf nur mit Zeitgrenze.** `HWND_BROADCAST` stellt die Nachricht *jedem* Fenster einzeln
  zu, und `SendMessage` wartet dabei auf jede einzelne Antwort. Ein Fenster, das gerade nicht
  pumpt, haelt den Aufruf unbegrenzt fest. Gemessen am 2026-09-10 auf dem Entwicklungsrechner:
  `SendMessage` kam nach 25 Sekunden nicht zurueck, `SendMessageTimeout` mit `SMTO_ABORTIFHUNG`
  nach 55 Millisekunden. Auf dem Geraet friert das den dauerhaft offenen PowerShell-Prozess in
  diesem einen Aufruf ein; jeder weitere Ein- und Ausschaltbefehl reiht sich dahinter ein und
  wird nie ausgefuehrt -- von aussen nicht von 1.0.0 zu unterscheiden. `panel.js` verwendet
  deshalb ausschliesslich `SendMessageTimeout`, und `test/panel.test.js` misst die Dauer, statt
  nur den Text zu pruefen.

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

- **Karten-Einstellungen leben an genau zwei Stellen.** `settingsFieldsForType()` in
  `editor.js` entscheidet, welche Felder ein Typ bekommt; `buildCard()` in
  `dashboard-render.js` liest sie. Wer eine Einstellung nur an einer der beiden Stellen
  anlegt, bekommt keinen Fehler, sondern ein Feld ohne Wirkung — genau so war
  `gauge.baseColor` über Monate tot. Die vollständige Bestandsaufnahme steht in
  `.scratch/karten-einstellungen/spec.md`, samt der Punkte, die bewusst **nicht** gebaut
  wurden und warum.
- **Neue Standardwerte ändern bestehende Anzeigen.** Die Nachkommastellen sind deshalb
  standardmäßig leer und lassen den Wert unverändert. Wer hier später auf „zwei Stellen ab
  Werk" umstellt, ändert stillschweigend jede Karte, die seit Jahren so hängt.

- **`el.hidden` allein blendet hier nichts aus.** Der Browser bringt `[hidden] { display: none }`
  nur im Benutzeragenten-Stylesheet mit, und das verliert gegen **jede** Regel in
  `dashboard.css` — schon gegen eine Klassenregel mit `display: flex`. Genau so stand der
  Zurück-Knopf auf dem Hauptdashboard und die Termin-Anzeige als leerer Glaskasten oben
  rechts, obwohl beide auf `hidden` standen. Deshalb steht ganz oben in `dashboard.css` ein
  `[hidden] { display: none !important; }`. Wer diese Zeile entfernt, bricht jede
  Sichtbarkeitssteuerung, die über `hidden` läuft — und zwar lautlos.
- **Das Symbol einer Klima-Karte muss zeigen, was die Anlage TUT.** Vorher trug sie immer
  dasselbe Symbol — auch ausgeschaltet stand dort ein Kühlsymbol, und aus dem Vorbeigehen las
  man das Gegenteil der Wahrheit. Die Bewegung ist dabei keine Spielerei: Sie unterscheidet
  „läuft gerade" (`hvac_action`) von „ist eingestellt" (`state`). Steht die Flamme still,
  heizt die Anlage nicht — das steht sonst nirgends auf der Karte.
- **In `openSettings()` gilt eine Reihenfolge:** Erst wird `html` zusammengebaut, dann
  `$('settingsBody').innerHTML = html`, und **erst danach** darf Code die neuen Elemente
  anfassen. Steht ein `$('…')` davor, liefert es `null`, der Fehler bricht den ganzen Aufbau
  ab — und die Einstellungen lassen sich **gar nicht mehr öffnen**, nicht nur die eine Gruppe.
  Genau so war die Alarm-Karte zwei Versionen lang unerreichbar.
- **`editor.html` lädt `setup/style.css` NICHT.** Es bindet nur `nav.css` und `dashboard.css`
  ein und bringt seine Regeln in einem eigenen `<style>`-Block mit. Wer dort etwas gestalten
  will und es in `style.css` schreibt, bekommt keinen Fehler — die Regel wirkt einfach nicht.
  Genau so ist eine Editor-Änderung zweimal ins Leere gelaufen. Gegenprobe im Browser:
  `[...document.styleSheets].map(s => s.href)`.
- **Editor-Änderungen nie ohne Hinsehen ausliefern.** Der Editor braucht eine laufende
  HA-Verbindung und ließ sich deshalb schlecht prüfen — mit dem Ergebnis, dass er zweimal
  hintereinander unbrauchbar ausgeliefert wurde. `.scratch/karten-design/editor-probe.js`
  stellt die nötigen API-Aufrufe mit Beispieldaten nach: `node` starten, dann
  `http://localhost:9930/setup/editor.html`.
- **Der Editor läuft auf einem anderen Gerät als das Panel.** Ohne die Panelgröße
  (`panelGroesse` aus `/api/config`, gefüllt von `getPanelSize` in `main.js`) zieht man Karten
  auf einem breiten Notebook zurecht und sieht erst auf der Wand, dass es nicht passt. Und es
  braucht **immer einen Weg an jede Karte heran**, der nicht über die Arbeitsfläche führt: Eine
  Karte kann hinter einer anderen liegen oder so groß gezogen sein, dass man ihre Knöpfe nicht
  trifft — dann ließ sie sich nicht einmal mehr löschen. Dafür ist die Kartenliste da.
- **Eine Verbesserung, die man erst einschalten muss, ist für die meisten keine.** Drei
  Releases in Folge bestanden fast nur aus Einstellungen — Symbole, Beschriftungen, untere
  Leiste, Testmodus —, und die Rückmeldung lautete folgerichtig „hat sich nichts geändert".
  Wer die Einstellungen nie öffnet, braucht die Hilfe am dringendsten. Deshalb: sinnvolle
  Vorgabe ab Werk, Einstellung nur zum Abweichen. `symbolErraten()` rät ein Knopfsymbol aus
  Beschriftung und Entitäts-ID, statt auf eine Auswahl zu warten.
- **Kein Mauszeiger auf der Anzeige.** `body.wandanzeige` blendet ihn überall aus. Er taucht
  sonst von allein auf, weil das Aufwecken mit dem Mauszeiger wackeln muss (`panel.js`), und
  bleibt dann mitten auf der Wand stehen. Bewusst an die Body-Klasse gebunden: Der
  Karten-Editor lädt dieselbe CSS-Datei, wird aber mit der Maus bedient.
- **Die Alarm-Zustände gehören der Anlage, nicht der App.** `armed_home` heißt nicht überall
  dasselbe — in der einen Anlage scharf mit freiem Innenbereich, in der anderen der ganz
  normale Zustand, wenn jemand da ist. Wer Text oder Farbe fest verdrahtet, erzählt der Hälfte
  der Nutzer etwas Unwahres über ihre Sicherheit. `ALARM_ZUSTAENDE` sind deshalb nur Vorgaben;
  `alarmDarstellung()` lässt Text **und** Farbton je Karte überschreiben.
- **Ein Knopf muss erkennbar sein, nicht lesbar.** Aus fünf Metern liest niemand „Tor" und
  „Garage" auseinander — ein Tor und eine Garage schon. Deshalb trägt jeder Tor-Knopf ein
  wählbares Symbol, groß, mit dem Text als Bestätigung darunter. Ein Symbol, das man suchen
  muss, ersetzt keinen Text.
- **Nach einer Schaltaktion meldet der Knopf, ob der Befehl ankam** — Haken oder Kreuz,
  gezeichnet statt eingeblendet, weil eine Bewegung am Rand des Blickfelds auffällt und ein
  Farbwechsel nicht. Das sagt **ausdrücklich nur**, dass Home Assistant den Befehl angenommen
  hat, nicht dass das Tor aufgegangen ist; das weiß die App nicht, und so zu tun als ob wäre
  schlimmer als nichts zu sagen. `callService()` liefert dafür true/false — wer das ändert,
  nimmt jedem Knopf die Rückmeldung.
- **Eine neue Karte darf nie auf einer bestehenden landen.** `findFreeSpot()` gab bei vollem
  Raster früher „die letzte Zeile als Notlösung" zurück — die neue Karte lag dann halb unter
  einer anderen, und man musste erst merken, dass da zwei sind. Jetzt liefert es `null`, und
  jeder Aufrufer muss das behandeln. Vorher wird noch mit kleineren Maßen gesucht, damit eine
  große Vorgabegröße nicht daran scheitert, dass nur ein Feld frei ist.
- **Das Raster hat feste sechs Zeilen, kein `flex: 1`.** Nur so ist der Streifen darunter
  (`.unterleiste`) vorhersagbar groß: Was das Raster übrig lässt, bekommt er. Mit `flex: 1`
  nähme das Raster die ganze Höhe und der Streifen wäre mal da, mal nicht. Die Karte dort
  trägt `unterleiste: true` im Layout — sie hat **kein** x/y, und jede Rasterlogik
  (Kollisionsprüfung, freier Platz, Rendern) muss sie deshalb ausfiltern, sonst gilt sie als
  Hindernis bei 0,0.
- **Der Weg zurück darf nie verschwinden.** Der Zurück-Knopf in der Kopfzeile ist seit dem
  Redesign ausgeblendet (`.statusbar { display: none }`), und die Reiter-Leiste am unteren Rand
  ist entfallen. Übrig bleibt `#zurueckKnopf` — er ist die **einzige** Rückkehr von einem
  Unterdashboard. Wer ihn entfernt, sperrt den Nutzer dort ein.
- **Der Bedien-Schutz darf einen Dashboardwechsel nicht aufhalten.** `render()` verschiebt den
  Neuaufbau, solange jemand bedient — aber das Antippen der Wechsel-Karte zählt selbst als
  Bedienung. Ohne `aufbauErzwingen` in `navigateTo()` tippt man, es passiert nichts, und nach
  zwölf Sekunden wechselt es von allein. Gemeldet wurde das als „bleibt auf dem
  Hauptdashboard". Wer künftig etwas einbaut, das die Ansicht als Ganzes wechselt, muss
  denselben Weg nehmen.
- **Die Setup-Oberfläche läuft im UNSICHEREN Kontext.** Sie wird über `http://<ip>:8788`
  aufgerufen, nicht über HTTPS. Alles, was der Browser nur im sicheren Kontext freigibt, ist
  dort schlicht nicht da: `navigator.clipboard` ist `undefined`, und der Zugriff darauf wirft.
  Nachgemessen über die LAN-Adresse: `isSecureContext = false`. Auf dem Gerät selbst
  (localhost) funktioniert es — **deshalb versteckt sich so ein Fehler beim Entwickeln und
  zeigt sich erst beim Benutzen.** Wer hier eine Browser-Schnittstelle einsetzt, prüft sie
  über die LAN-Adresse, nicht über localhost; `.scratch/karten-design/zwischenablage-probe.html`
  macht genau das. Für die Zwischenablage gilt zusätzlich: `execCommand('copy')` braucht eine
  frische Benutzergeste, ein `await` davor kann sie verfallen lassen. Verlass ist auf keinen
  von beiden — es braucht immer einen Weg, der ohne auskommt (Text zum Selbstmarkieren, Datei
  zum Herunterladen).
- **Neue Routen nicht unter einen `:id`-Pfad legen.** Express nimmt die erste passende Route.
  `/api/dashboards/import` wurde von `app.post('/api/dashboards/:id')` verschluckt — `import`
  war für sie eine Dashboard-Kennung, und jeder Import antwortete „Dashboard nicht gefunden".
  Deshalb heißen die Austausch-Routen `/api/dashboard-import`, `/api/dashboard-format`,
  `/api/dashboard-haupt/export`: Pfade, die gar nicht erst kollidieren können, sind haltbarer
  als eine Reihenfolge, die beim nächsten Einfügen wieder kippt. Gefunden wurde das **auf dem
  Gerät**, nicht im Test — die Modultests prüften das Modul, und das Modul war in Ordnung; der
  Fehler lag im Weg dorthin. `test/server-austausch.test.js` geht diesen Weg jetzt.
- **Ein Export darf nichts enthalten, was nicht mitreist.** Foto-Karten speichern nur eine
  Versionsnummer, das Bild liegt auf dem Gerät. Wer solche Felder mitexportiert, erzeugt
  woanders Karten mit kaputten Bildverweisen — lautlos. `dashboard-austausch.js` entfernt sie
  und **gibt zurück, was es entfernt hat**; diese Liste gehört dem Nutzer angezeigt, nicht
  verschluckt. Beim Import gilt dasselbe in die andere Richtung.
- **Die Austauschdatei trägt ihre Anleitung in sich.** Sie ist allein unterwegs — in einem
  Chatfenster, in einer Mail, auf einem Stick; was dort nicht drinsteht, ist nicht da. Die
  Liste der Kartenarten kommt aus `CARD_TYPES` und nicht aus einer zweiten Aufzählung, und ein
  Test prüft, dass die Anleitung **genau** die Arten nennt, die der Import akzeptiert. Eine
  Anleitung, die etwas vorschlägt, das beim Einspielen abgelehnt wird, ist schlimmer als keine.

## Design

**Farbe ist Akzent, nicht Fläche.** Eine Karte bekommt Farbe ausschließlich über
`--kachel-akzent`; daraus speisen sich Symbol, Regler und der Aktiv-Schein. Wer statt dessen
`background` auf einer Karte setzt, stanzt sich durch die Glasfläche und bricht den ganzen
Entwurf — genau das war bis 1.7.0 der Fall, siehe
[ADR 0004](docs/adr/0004-farbe-als-akzent-statt-als-kachelfarbe.md).

**Die Karte ist der Regler.** Lampen und Ventilatoren mit Stufen haben keinen eigenen
Schiebregler mehr: Wischen auf der Kachel setzt den Wert, Tippen schaltet um. Die Grenze
zwischen beidem liegt bei zehn Pixeln — darunter zittert nur der Finger, und ein Zittern darf
nicht die Helligkeit verstellen. Während des Wischens wird **nur die Anzeige** nachgeführt; ein
Dienstaufruf pro Bild würde Home Assistant fluten und die Lampe flackern lassen.

**Ein Aufbau für alle Karten:** Symbolzeile (Symbol links, Zustand rechts), Wert, Name als
Bildunterschrift, Bedienelemente. Linksbündig, ausnahmslos. Abweichungen fallen einzeln nicht
auf und in der Summe sofort.

Ein Design nicht ohne Hinsehen ändern: `.scratch/karten-design/vorschau.html` lädt dieselbe
CSS-Datei und dasselbe Render-Modul mit erfundenen Zuständen und lässt sich im Browser öffnen —
ohne Home Assistant, ohne Electron, ohne Gerät. **Beide Themes prüfen.** Weiße Auflagen
(`rgba(255,255,255,…)`) sind auf hellem Glas unsichtbar; themenabhängige Flächen gehören als
`color-mix(in srgb, var(--text) …%, transparent)` geschrieben.

Das eingebaute Design `DEFAULT_THEME` in `dashboard-render.js` ist ab Werk aktiv; ein
importiertes Design gewinnt. Der Seitenhintergrund ist dort bewusst ein **Standbild** aus
denselben Farbwolken, die der Ankunftsschirm bewegt zeigt: Hinter Zahlen und Diagrammen
konkurriert eine laufende Animation mit dem Inhalt, und ein Dashboard schaut man tagelang an.

Bei der Animation im Ankunftsschirm läuft der Zufall **nur bei der Geburt einer Form**, alle
zehn bis zwanzig Sekunden. Dazwischen bewegt der Browser auf der Grafikeinheit, nicht
JavaScript. Wer das ändert und pro Bild rechnet, kostet das Gerät die Bildrate.

## Tests

```bash
npm test
```

215 Tests über Kalenderauswertung, Zustandslogik, Zugangsschutz, Kartenaufbau, Ankunftsschirm
und den PowerShell-Vorspann.
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
