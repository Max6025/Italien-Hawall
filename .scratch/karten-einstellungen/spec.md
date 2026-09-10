# Karten: Einstellungen und Fehler

Bestandsaufnahme vom 2026-09-10 ueber alle 27 Kartentypen. Fuer den zweiten Rutsch --
im ersten wurden Theme, Ankunftsschirm, Groessenmodell, Kopfzeile und Tor-Card gebaut.

## Ausgangslage

`settingsFieldsForType()` in `renderer/setup/editor.js:355` ist die EINZIGE Stelle, die je
Kartentyp Felder aufbaut. Es gibt dort nur neun Feldgruppen: name, suffix, gaugeExtras,
navigateTarget, forecastType, energyEntities, mediaPlayerOpts, photoUpload, quickTiles.
Alles andere ist fest verdrahtet.

## Das sind FEHLER, keine fehlenden Einstellungen

Diese Punkte gehoeren getrennt behandelt -- sie kosten wenig und wirken sofort:

1. **Kein Escaping in Karteninhalten.** `settings.name`, Muell-`summary`, Kachel-Beschriftungen
   und Select-Optionen gehen roh in `innerHTML`. Ein Kalendertitel mit `<` zerlegt die Karte.
   Betrifft direkt die Kalendersteuerung, wo Termintitel angezeigt werden.
2. **Schloss-Karte ohne Rueckfrage.** Ein Fehlgriff auf dem Wandpanel schliesst die Tuer auf.
   Auf einem Geraet, das Gaesten zugaenglich ist, ist das keine Kleinigkeit.
3. **`waste` und `forecast`: Zwischenspeicher werden NIE geleert.** Nur `historyCache` laeuft
   im 5-Minuten-Takt ab. Muelltermine und Wettervorhersage frieren beim App-Start ein und
   veralten ueber Tage -- bei einem Geraet, das jetzt durchlaeuft, garantiert sichtbar.
4. **`humidity`: Einzeiler.** Die Karte liest `settings.suffix`, aber `humidity` fehlt in der
   `withSuffix`-Liste (`editor.js:356`) -- das Feld ist im Editor nicht erreichbar.
5. **`gauge`: tote Einstellung.** `buildCard` liest `settings.baseColor`, kein Editor-Feld
   schreibt es je.
6. **Vollstaendiger Neuaufbau alle 15 s** (`grid.innerHTML = ''`). Jede Interaktion --
   Lautstaerkeregler, offenes Auswahlmenue, Positions-Slider -- wird mittendrin zerstoert.

## Die fuenf groessten Luecken bei den Einstellungen

1. **waste** -- Zeitraum (60 Tage), Anzahl (4) und Tonnenfarben hart codiert; unbekannte
   Tonnenarten werden ausnahmslos grau, ohne Gegenmittel.
2. **graph** -- `hours=24` an zwei Stellen fest; keine Achsengrenzen, keine Zeitachse, keine
   Farbwahl. Die Bereichsbeschriftung stammt aus Rohdaten, die Kurve ist geglaettet.
3. **alarm** -- drei feste Knoepfe, kein Code-Feld. Bei `code_arm_required` passiert beim
   Druck nichts, ohne Fehlermeldung. `armed_night` wird angezeigt, aber nicht schaltbar.
4. **climate** -- Schrittweite fest 0,5, Einheit hart `'°C'`; `target_temp_step`, `min_temp`
   und `max_temp` werden ignoriert. Kein HVAC-Modus, kein Preset.
5. **energy** -- Aktiv-Schwelle 5 W, nur kW-Umrechnung, feste Beschriftungen, kein
   Vorzeichen-Umschalter. Passt die Konvention der Anlage nicht, fliesst die Energie auf dem
   Display in die falsche Richtung.

## Weitere Karten mit Handlungsbedarf

- **cover**: kein Positions-Slider, obwohl `current_position` angezeigt wird
- **media_player**: Fortschrittsbalken ignoriert `media_position_updated_at`, bis zu 15 s falsch
- **fan**: Slider-Schritt fest 10, ignoriert `percentage_step`
- **light**: kein Farb-/Farbtemperaturregler; Slider auf 0 sendet `turn_on` mit 0 % statt `turn_off`
- **select**: Dropdown wird bei jedem Refresh neu gebaut, schliesst sich unter der Hand
- **temperature**: Einheit ohne Leerzeichen angehaengt, inkonsistent zu allen anderen Karten
- **radar**: Bildwechsel fest 5 Minuten, keine Animation
- **forecast**: Anzahl fest 5 Tage / 6 Stunden, kein Niederschlag, kein Wind
- **clock**: im Editor gar nicht waehlbar (`PICKER_TYPES` filtert sie raus), Locale hart `de-DE`
- **photo**: nur ein Bild, keine Diashow; beim Typwechsel bleibt die Datei verwaist liegen
- **quicktiles**: nur `media_player.select_source`, kein Skript, keine Szene

## Querschnitt

Kein einziger Kartentyp hat eine Einstellung fuer Nachkommastellen, Symbol oder
Aktualisierungsintervall.
