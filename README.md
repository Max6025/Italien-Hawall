# Italien Wall Display

Ein eigenständiges Wandpanel für Home Assistant unter Windows, dessen Anzeige **von einem
Kalender gesteuert** wird.

Steht in dem verknüpften Kalender ein Termin, dessen Titel eines deiner Keywords enthält, zeigt
das Gerät sein Dashboard. Läuft kein passender Termin, wird der Bildschirm **wirklich
abgeschaltet** — Hintergrundbeleuchtung aus, nicht nur ein schwarzes Bild über einem
leuchtenden Panel.

Abgeleitet von [HA Wall Display](https://github.com/Max6025/Hawall), aber ein eigenständiges
Projekt mit eigener Konfiguration, eigenem Port und eigenem Update-Kanal. Beide Anwendungen
können auf demselben Gerät nebeneinander laufen.

## Was es kann

- **Kalendersteuerung** über einen beliebigen Kalender aus Home Assistant (Google, Local
  Calendar, CalDAV — die Anwendung muss das Backend nicht kennen)
- **Mehrere Keywords**, kommagetrennt. Es genügt, dass das Wort im Titel vorkommt;
  Groß-/Kleinschreibung spielt keine Rolle
- **Mehrtägige Termine** halten den Bildschirm entsprechend mehrere Tage an
- **Vorlauf und Nachlauf** in Minuten, falls der Bildschirm etwas früher an sein soll
- **Nachtsperre** mit Vorrang vor dem Kalender: in diesem Zeitfenster bleibt der Bildschirm aus,
  auch wenn ein Termin läuft
- **Zugangscode** für die Einrichtungsseite
- das komplette Karten-Dashboard von HA Wall Display: Editor, Unterdashboards, Themes,
  Screensaver (standardmäßig aus), Annäherungserkennung, Auto-Update

## Installation

Den Installer aus den [Releases](https://github.com/Max6025/Italien-Hawall/releases) herunterladen
und ausführen. Eine Datei für x64 und ARM64 — das Setup wählt selbst das passende.

Nach der Installation startet die Anwendung bei jeder Windows-Anmeldung automatisch im Vollbild.

## Einrichtung

Die Einrichtung läuft **von einem anderen Gerät aus im Browser**, nicht auf dem Panel selbst.

1. Beim ersten Start zeigt das Display „Bereit zum Einrichten" und seine IP-Adresse
2. Im Browser `http://<IP>:8788/setup/` öffnen
3. Home-Assistant-Adresse und Long-Lived Access Token eintragen
4. Auf der Seite **Design** ganz nach unten scrollen zu **Kalendersteuerung**:
   Kalender auswählen, Keywords eintragen, aktivieren
5. Direkt darunter unter **Zugangscode** einen Code vergeben — ohne ihn ist die
   Einrichtungsseite für jeden im selben Netzwerk offen

Mit **Treffer anzeigen** lässt sich sofort prüfen, welche Termine die Keywords finden, ohne auf
den nächsten Termin warten zu müssen.

## Wenn du ans Gerät musst

Läuft kein Termin, schaltet ein Wächter den Bildschirm alle fünf Sekunden wieder ab — auch wenn
du ihn durch Berühren aufweckst. Es gibt drei Wege, das für 30 Minuten anzuhalten:

| Weg | Wo | Funktioniert auch |
|---|---|---|
| Fünfmal schnell in die **obere linke Ecke** tippen | am Panel | ohne Tastatur und ohne Netzwerk |
| Schalter **30 Minuten pausieren** | Einrichtungsseite, Abschnitt Kalendersteuerung | vom Handy aus |
| **Strg+Alt+W** | am Panel | wenn eine Tastatur angeschlossen ist |

Die Pause endet immer von selbst. **Strg+Alt+Q** beendet die Anwendung ganz.

Zwei weitere Sicherungen greifen automatisch: Solange die Kalendersteuerung nicht vollständig
eingerichtet ist, wird nie abgeschaltet — und nach jedem Start gilt eine Karenzzeit von zehn
Minuten.

## Wenn Home Assistant nicht erreichbar ist

Der zuletzt bekannte Zustand bleibt bestehen: Ein Netzausfall mitten im Termin schaltet den
Bildschirm nicht ab, und ein Ausfall im Leerlauf schaltet ihn nicht ein. Nach drei
fehlgeschlagenen Abrufen in Folge (etwa sechs Minuten) erscheint eine Fehlerseite — aber nur,
wenn der Bildschirm ohnehin an ist. Alle Fehler landen in
`%APPDATA%\Italien Wall Display\kalendersteuerung.log`.

Warum das so ist, steht in [ADR 0003](docs/adr/0003-stillbleiben-bei-netzausfall.md).

## Entwicklung

```bash
npm install
npm test      # 24 Tests für Kalenderauswertung und Zustandslogik
npm start     # lokal starten
npm run dist  # Installer bauen
```

Die Begriffe des Projekts sind in [CONTEXT.md](CONTEXT.md) festgelegt, die
Architekturentscheidungen in [docs/adr/](docs/adr/).

Die Kalender- und Bildschirmsteuerung liegt bewusst im **Hauptprozess** unter `control/`, nicht
im Renderer: Der Wächter muss auch dann laufen, wenn gerade kein Dashboard geladen ist.

| Datei | Aufgabe |
|---|---|
| `control/calendar.js` | Kalender abrufen, Treffer finden, Anzeigefenster berechnen |
| `control/panel.js` | Panel unter Windows ein-/ausschalten |
| `control/controller.js` | Zustandsautomat: entscheidet, ob das Panel an sein soll |

## Lizenz

MIT — siehe [LICENSE](LICENSE).
