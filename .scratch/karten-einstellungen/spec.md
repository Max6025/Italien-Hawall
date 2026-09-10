# Karten: Einstellungen und Fehler

Bestandsaufnahme vom 2026-09-10 ueber alle 28 Kartentypen. **Abgearbeitet in 1.5.0 bis 1.7.0.**

## Ausgangslage (historisch)

`settingsFieldsForType()` in `renderer/setup/editor.js` war die EINZIGE Stelle, die je
Kartentyp Felder aufbaut, und kannte nur neun Feldgruppen: name, suffix, gaugeExtras,
navigateTarget, forecastType, energyEntities, mediaPlayerOpts, photoUpload, quickTiles.
Alles andere war fest verdrahtet. Heute sind es zwanzig.

## Fehler — alle behoben

| # | Fehler | Behoben in |
|---|---|---|
| 1 | Kein Escaping in Karteninhalten (`settings.name`, Muell-`summary`, Kachel-Beschriftungen, Select-Optionen gingen roh ins `innerHTML`; ein Termintitel mit `<` zerlegte die Karte) | 1.5.0 |
| 2 | Schloss-Karte ohne Rueckfrage — ein Fehlgriff auf dem Wandpanel schloss die Tuer auf | 1.5.0 |
| 3 | `waste` und `forecast`: Zwischenspeicher wurden nie geleert, froren beim App-Start ein | 1.5.0 |
| 4 | `humidity`: las `settings.suffix`, fehlte aber in `withSuffix` — Feld im Editor unerreichbar | 1.5.0 |
| 5 | `gauge`: `settings.baseColor` wurde gelesen, aber von keinem Feld je geschrieben | 1.6.0 |
| 6 | Vollstaendiger Neuaufbau alle 15 s zerstoerte jede laufende Bedienung | 1.4.0/1.4.1 |
| 7 | `media_player`: Fortschrittsbalken ignorierte `media_position_updated_at`, hinkte bis zu 15 s | 1.6.0 |
| 8 | `light`: Regler auf 0 sendete `turn_on` mit 0 % statt `turn_off` | 1.5.0 |
| 9 | `temperature`: Einheit ohne Leerzeichen angehaengt, als einzige Karte | 1.6.0 |
| 10 | `photo`: beim Typwechsel und beim Loeschen blieb die Bilddatei verwaist liegen | 1.7.0 |
| 11 | Ankunftsschirm: `inhaltSetzen()` setzte bei jeder Zustandsmeldung den Bildwechsel zurueck | 1.6.1 |

## Einstellungen — alle nachgeruestet

**waste** (1.6.0) — eigene Tonnenfarben, gehen den eingebauten vor; Anzahl der Termine.
Bewusst Teilzeichenkette statt regulaerem Ausdruck: Die Muster kommen aus einem Eingabefeld.

**graph** (1.5.0) — Zeitraum, Achsengrenzen, Zeitangabe in der Bildunterschrift.

**alarm** (1.5.0) — Code-Eingabe abhaengig von `code_format`/`code_arm_required`, Knoepfe
abhaengig von `supported_features`.

**climate** (1.5.0) — `hvac_modes`, `preset_modes`, `target_temp_step`, `min_temp`, `max_temp`
kommen vom Geraet statt fest verdrahtet.

**energy** (1.6.0) — Aktiv-Schwelle, Batterie-Vorzeichen umschaltbar, vier freie
Beschriftungen. Der Anzeigename diente vorher doppelt als Haus-Beschriftung.

**cover** (1.5.0) — Positions- und Neigungsregler, abhaengig von `supported_features`.

**light** (1.5.0) — Farbtemperatur und Farbwahl, abhaengig von `supported_color_modes`.

**forecast** (1.6.0) — Spaltenzahl, Niederschlag, Wind.

**fan** (1.5.0) — Schrittweite aus `percentage_step`.

**select** (1.6.0) — durch den Bedien-Schutz abgedeckt: Ein fokussiertes Auswahlmenue haelt
den Neuaufbau auf.

**radar** (1.7.0) — Bildwechsel-Intervall, war fest auf fuenf Minuten.

**clock** (1.7.0) — Sprache/Region, 12/24 Stunden, Sekunden, Datum ausblendbar. Vorher hart
`de-DE`. Im Editor waehlbar seit 1.5.0.

**photo** (1.7.0) — bis zu acht Bilder als Diashow mit einstellbarem Wechsel. Bild 1 behaelt
die Speicher-ID ohne Nummer, damit bestehende Karten ihr Bild behalten.

**quicktiles** (1.7.0) — Kacheln loesen auch Skripte und Szenen aus, nicht nur
`media_player.select_source`. Kacheln ohne `art`-Feld gelten weiter als Quellenwahl.

**gate** (1.5.0) — freie Knopfliste, Meldetext, Taster-Verhalten mit Schalter-Ausnahme.

## Querschnitt (1.7.0)

- **Nachkommastellen** fuer alle Karten mit einem grossen Zahlenwert. Ohne Einstellung bleibt
  der Wert unveraendert — bewusst kein Standard-Runden, sonst haette dieses Update
  stillschweigend jede bestehende Karte geaendert. Gesetzt wird deutsch formatiert.
- **Symbol** frei waehlbar mit Vorschau, ausser bei Karten ohne eigenes Symbol (Uhr, Foto,
  Kacheln, Energiefluss, Media Player, Schalter mit eigenem Zustandssymbol).

## Bewusst NICHT gebaut

**Aktualisierungsintervall je Karte.** Das Raster ruft alle Zustaende in einer einzigen
Abfrage ab und baut sich als Ganzes neu auf; eine Karte, die fuer sich pollt, gaebe es dafuer
nicht. Ein Feld „alle X Sekunden" waere an den meisten Karten wirkungslos — eine Einstellung,
die nichts tut, ist schlimmer als keine. Wo ein eigener Takt wirklich existiert, ist er
einstellbar: Regenradar (Bild), Foto (Diashow), Ankunftsschirm (Bildwechsel). Muelltermine und
Wettervorhersage haben feste Zwischenspeicher-Zeiten (6 h bzw. 30 min), die zu den Daten
passen und keinen Regler brauchen.

**Reihenfolge der Fotos aendern.** Die Bilder haengen an ihrer Position, nicht an einer
eigenen Kennung. Umsortieren hiesse serverseitig umhaengen, und dafuer gibt es keine Route.
Entfernen laesst sich deshalb nur das letzte Bild — ein Knopf, der still Bilder verliert,
waere schlimmer als keiner.
