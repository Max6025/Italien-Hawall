// Versionshistorie fuer die Changelog-Seite. "major" = auffaellige Kachel (grosses
// Update), "minor" = schlichte Liste (kleinere Aenderung). Neueste zuerst.
window.HAWALL_CHANGELOG = [
  {
    version: '1.8.5', date: '2026-08-08', type: 'minor',
    title: 'Annäherungserkennung deutlich robuster',
    improvements: [
      'Erkennung nutzt jetzt mehrere Bildbereiche statt eines einzigen groben Gesamt-Durchschnittswerts – zuverlässiger, wenn eine Person nicht das ganze Kamerabild ausfüllt (z.B. seitlich oder weiter entfernt)',
      'Kurze einzelne Störungen (Kamera-Rauschen, kurzer Lichtwechsel) lassen die Erkennung nicht mehr fälschlich "niemand da" melden – braucht jetzt mehrere aufeinanderfolgende Messungen, bevor sie wirklich "weg" meldet (genauso wie es vorher schon beim Erkennen einer Person brauchte)'
    ]
  },
  {
    version: '1.8.4', date: '2026-08-07', type: 'minor',
    title: 'Kamera blieb beim Nachtmodus manchmal an (Bugfix)',
    improvements: [
      'Echten Fehler behoben: War der Screensaver aktiv, als der Nachtmodus einsetzte, konnte die Kamera durch eine Race Condition (zu früher Stopp-Befehl, bevor der interne Start-Vorgang fertig war) fälschlich eingeschaltet bleiben, statt sich abzuschalten. Per Test mit realistischer Zeitverzögerung nachgestellt und bestätigt behoben – die Kamera läuft jetzt zuverlässig nur noch, während der Bildschirm wirklich wach ist.'
    ]
  },
  {
    version: '1.8.3', date: '2026-08-07', type: 'minor',
    title: 'Annäherungserkennung: Empfindlichkeit einstellbar',
    improvements: [
      'Neuer Regler auf der Design-Seite, um die Empfindlichkeit der Annäherungserkennung selbst anzupassen – hilft, wenn sie zu häufig oder zu selten "jemand da" meldet',
      'Kleiner grüner Punkt oben links zeigt live an, ob gerade eine Person erkannt wird – praktisch zum Einstellen der richtigen Empfindlichkeit, verschwindet automatisch wenn die Funktion aus ist'
    ]
  },
  {
    version: '1.8.3', date: '2026-08-07', type: 'minor',
    title: 'Annäherungserkennung unempfindlicher',
    improvements: [
      'Schwellenwert deutlich erhöht und eine zusätzliche Bestätigung verlangt, bevor "Anwesenheit" gemeldet wird – reduziert Fehlauslösungen durch Lichtschwankungen/Kamera-Rauschen, die den Bildschirm nicht mehr in den Screensaver wechseln ließen',
      'Kleiner grüner Statuspunkt oben links zur Kontrolle war bereits vorhanden (leuchtet bei erkannter Anwesenheit, komplett unsichtbar bei deaktivierter Funktion) – nochmal geprüft und bestätigt'
    ]
  },
  {
    version: '1.8.2', date: '2026-08-07', type: 'minor',
    title: 'Tracker-Dashboard aktualisiert sich jetzt korrekt',
    improvements: [
      'Bug behoben: Beim Tracker-Unterdashboard wurde beim automatischen Aktualisieren und beim Aufwecken aus Bildschirmschoner/Nachtmodus fälschlich das (versteckte) Karten-Raster statt der Kartenansicht neu gezeichnet – Position, Akkustand und Zonen blieben dadurch eingefroren. Jetzt korrekt.'
    ]
  },
  {
    version: '1.8.2', date: '2026-08-07', type: 'minor',
    title: 'Tracker-Karte über Screensaver-Bug behoben, Annäherungserkennung neu gedacht',
    improvements: [
      'Bug behoben: Auf der Tracker-Karte lief die Kartenansicht über den Screensaver/Nachtmodus hinweg weiter sichtbar, statt dahinter zu verschwinden',
      'Annäherungserkennung komplett neues Verhalten: weckt den Bildschirm nicht mehr von selbst auf (das macht weiterhin nur eine Berührung) – läuft stattdessen nur, während der Bildschirm schon wach ist, hält ihn wach solange jemand da ist, und schickt ihn sofort in den Screensaver, sobald niemand mehr erkannt wird',
      '"Screensaver erscheint nach"-Einstellung von der Screensaver-Seite auf die Design-Seite verschoben'
    ]
  },
  {
    version: '1.8.1', date: '2026-08-07', type: 'minor',
    title: 'Sichtbarkeits-Bugfix + mehr Tracker-Einstellungen',
    improvements: [
      'Bug behoben: Die Dashboard-Reiter-Leiste und die Tracker-Zeitraum-Buttons wurden bei importierten Designs (z.B. Liquid Glass) fast unsichtbar – nutzen jetzt dieselben anpassbaren Farben wie die Karten',
      'Tracker-Einrichten-Seite deutlich erweitert: eigenes Symbol für den Marker hochladbar, Standard-Zoomstufe einstellbar, automatisches Zentrieren ein/aus, Home-Assistant-Zonen (z.B. "Zuhause") als Kreis einzeichenbar'
    ]
  },
  {
    version: '1.8.0', date: '2026-08-06', type: 'major',
    title: 'Neuer Unterdashboard-Typ: Tracker',
    improvements: [
      'Beim Anlegen eines Unterdashboards jetzt wählbar: "Karten" (wie bisher) oder "Tracker"',
      'Tracker-Unterdashboards zeigen eine OpenStreetMap-Karte mit aktuellem Standort und Akkustand einer device_tracker/person-Entität (z.B. ein GPS-Halsband)',
      'Verlauf über einen wählbaren Zeitraum als Route einzeichenbar – Schnellauswahl (6/24 Std, Heute, Gestern, 7 Tage) oder frei wählbarer Zeitraum',
      'Kostenlos, ohne API-Key/Account – nutzt OpenStreetMap statt Google Maps'
    ]
  },
  {
    version: '1.7.1', date: '2026-08-06', type: 'minor',
    title: 'Design-Import kann jetzt Glas-Effekte ("Liquid Glass")',
    improvements: [
      'Design-Import-Dateien können jetzt Weichzeichner-Effekt (Glas/Milchglas), Sättigungs-Boost, Lichtkanten und einen farbigen Seitenhintergrund definieren – für Effekte wie Apples "Liquid Glass"',
      'Neues Feld "extraCss" als Escape-Hatch für beliebig komplexere Designs, die über die vordefinierten Felder hinausgehen',
      'Ein fertiges Liquid-Glass-Beispieldesign liegt zum direkten Import bereit'
    ]
  },
  {
    version: '1.7.0', date: '2026-08-06', type: 'major',
    title: 'Setup-Oberfläche modernisiert, Design-Import, Schnellzugriff-Kacheln',
    improvements: [
      'Komplette Setup-Oberfläche (Verbindung, Design, Unterdashboards, Update, Changelog) im selben edlen, dunklen Stil wie das überarbeitete Dashboard – vorher noch im alten hellen Look',
      'Neue Seite "Design-Import": eine Design-Datei (.json) hochladen und Farben sowie Formen/Abstände (Kartenrundung, Ränder, Schatten) auf einen Schlag ersetzen, statt alles einzeln einzustellen',
      'Neuer Kartentyp "Schnellzugriff-Kacheln": mehrere Kacheln mit eigenem Bild nebeneinander, jede startet eine bestimmte Quelle auf einem gewählten Media-Player-Gerät (z.B. "Netflix am Fernseher"). Die gerade laufende Quelle wird ganz dezent hervorgehoben, ohne die anderen Kacheln auszugrauen'
    ]
  },
  {
    version: '1.6.1', date: '2026-08-05', type: 'minor',
    title: 'Media Player: mehr Funktionen',
    improvements: [
      'Ein/Aus-Taste ergänzt',
      'Quellenauswahl (z.B. Spotify/TV/Bluetooth) – erscheint automatisch, wenn das Gerät mehrere Quellen unterstützt',
      'Fortschrittsbalken mit Zeitanzeige – erscheint automatisch, wenn das Gerät Positions-/Dauer-Daten liefert',
      'Beide neuen Anzeigen einzeln in den Karten-Einstellungen abschaltbar'
    ]
  },
  {
    version: '1.6.0', date: '2026-08-05', type: 'major',
    title: 'Neues Design, Foto-Karten, Reiter-Navigation',
    improvements: [
      'Komplett neues Erscheinungsbild: Dark Mode jetzt sehr dunkel/edel, Light Mode warmes Hellgrau statt reinem Weiß, alle Karten mit größerer Rundung, feinem Rand und weichem Schatten',
      'Neuer Kartentyp "Foto-Bereich" – eigenes Bild pro Karte; Media-Player- und Wetter-Karten dürfen darauf platziert werden und bekommen automatisch einen durchscheinenden Glas-Effekt',
      'Wechsel zwischen Haupt- und Unterdashboards jetzt über eine Reiter-Leiste oben (Namen automatisch aus den Unterdashboards) statt per Wischgeste',
      'Umzug der automatischen Updates zurück zu GitHub inkl. neuer GitHub-Actions-Pipeline für automatisches Bauen+Veröffentlichen',
      'electron-builder-Bug behoben, der beim Veröffentlichen gelegentlich zwei Releases statt eines anzulegen versuchte'
    ]
  },
  {
    version: '1.5.8', date: '2026-08-05', type: 'minor',
    title: 'Umzug von GitHub auf GitLab',
    improvements: [
      'Auto-Update sucht jetzt nach Releases auf GitLab (gitlab.com/max6025/Hawall) statt GitHub',
      'electron-builder auf Version 26 aktualisiert (für GitLab-Unterstützung)'
    ]
  },
  {
    version: '1.5.7', date: '2026-08-04', type: 'minor',
    title: 'Echte Präsenzerkennung + Wisch-Fix',
    improvements: [
      'Annäherungserkennung arbeitet jetzt als echter Präsenzmelder (Vergleich gegen einen sich langsam anpassenden Hintergrund statt nur das letzte Bild) – hält den Bildschirm wach, solange jemand da ist, auch ohne Bewegung',
      'Windows-eigene Rand-Wischgesten (Action Center, Task-Ansicht, Widgets) werden beim Start automatisch deaktiviert – verhinderte bisher sowohl das ungewollte Windows-Menü als auch die eigene Wisch-Navigation zwischen Dashboards'
    ]
  },
  {
    version: '1.5.6', date: '2026-08-03', type: 'minor',
    title: 'Wischen zwischen Dashboards',
    improvements: [
      'Horizontales Wischen wechselt jetzt zwischen Hauptdashboard und Unterdashboards – mit Punkte-Anzeige unten wie beim Handy-Homescreen',
      'Annäherungserkennung (Frontkamera) und automatisches Wecken vor Berührung war bereits vorhanden – geprüft und bestätigt funktionsfähig'
    ]
  },
  {
    version: '1.5.5', date: '2026-08-02', type: 'minor',
    title: 'Neue Karte: Mülltermine',
    improvements: [
      'Neuer Kartentyp "Mülltermine" – bindet an eine calendar-Entität (z.B. von Abfall.io), zeigt den nächsten Termin groß + eine kurze Liste der folgenden, automatisch farbcodiert nach Tonnenart (Rest/Bio/Papier/Gelb/Glas/Sperrmüll)'
    ]
  },
  {
    version: '1.5.4', date: '2026-08-02', type: 'minor',
    title: 'Media Player überarbeitet, Nachtmodus dimmt, 5 neue Kartentypen',
    improvements: [
      'Media-Player-Karte neu gestaltet: große, runde Steuerelemente, Album-Cover als weichgezeichneter Hintergrund, Shuffle/Repeat/Stumm sofern unterstützt',
      'Nachtmodus senkt jetzt zusätzlich zum schwarzen Bildschirm auch die Gerätehelligkeit (unterstützte Geräte)',
      'Neue Kartentypen: Schloss, Ventilator, Saugroboter, Luftfeuchtigkeit, Alarmanlage'
    ]
  },
  {
    version: '1.5.3', date: '2026-08-02', type: 'minor',
    title: 'Screensaver-Hintergrundbild robuster',
    improvements: ['Hochgeladene Fotos werden vor dem Upload automatisch verkleinert (max. 1920px) – verhindert Fehler bei großen Handy-Fotos und lädt schneller auf dem Wall Display']
  },
  {
    version: '1.5.2', date: '2026-08-02', type: 'minor',
    title: 'Media-Player-Karte, Editor-Feinschliff, Update-Erlebnis',
    improvements: [
      'Neuer Kartentyp: Media-Player-Steuerung (Play/Pause, vor/zurück, Lautstärke, Cover)',
      'Debug-Seite aus der Navigation entfernt',
      'Editor: langer Hinweistext ersetzt durch "?"-Button mit Popup',
      'Editor: eigene Warnung beim Verlassen mit ungespeicherten Änderungen',
      'Verbindungs-Seite: Token-Feld verschwindet nach erfolgreicher Einrichtung, "Neuen Token eintragen" zum Ändern; zeigt jetzt die verbundene HA-Adresse an',
      'Update-Seite: Ladekreis während der Installation, automatisches einmaliges Neuladen sobald die App wieder läuft',
      'Wall Display selbst: nach einem Update durchgehender Ladekreis bis zum Neustart, danach 5s "Erfolgreich auf Version x.x.x aktualisiert"'
    ]
  },
  {
    version: '1.5.1', date: '2026-08-02', type: 'minor',
    title: 'Update-Installation ohne Admin-Dialog',
    bugfixes: ['Installationsordner ist jetzt fest auf den Benutzerordner gesetzt – dadurch fragt Windows bei automatischen Updates nicht mehr nach Admin-Rechten']
  },
  {
    version: '1.5.0', date: '2026-08-02', type: 'major',
    title: 'Neues Design & fester Karten-Bereich',
    improvements: [
      'Hawall-Branding und einheitliche Navigationsleiste auf allen Setup-Seiten',
      'Moderneres, saubereres Layout auf allen Setup-Seiten',
      'Karten-Editor auf feste, bildschirmgroße Arbeitsfläche umgestellt – Karten können nicht mehr aus dem Sichtbereich verschwinden',
      'Akku-Banner erscheint jetzt auch im Screensaver',
      'Diese Changelog-Seite'
    ],
    bugfixes: [
      'Kollisionsschutz beim Verschieben/Größerziehen von Karten (keine Überlappung mehr)',
      'Nachtmodus-Aufwecken zeigte manchmal fälschlich den Screensaver statt des Dashboards'
    ]
  },
  {
    version: '1.4.2', date: '2026-08-02', type: 'minor',
    title: 'Akkuwarnung korrigiert',
    improvements: ['Akkuwarnung bezieht sich jetzt auf den Windows-Geräte-Akku statt auf HA-Sensoren']
  },
  {
    version: '1.4.1', date: '2026-08-01', type: 'minor',
    title: 'Nachtmodus-Test-Schalter & robustere Batterieerkennung',
    improvements: ['Testschalter für den Nachtmodus (unabhängig von der Uhrzeit)'],
    bugfixes: ['Zustands-Abruf lief während des Nachtmodus komplett leer statt nur das Rendering zu pausieren']
  },
  {
    version: '1.4.0', date: '2026-08-01', type: 'major',
    title: 'Akkuwarnung, Nachtmodus & Unterdashboards',
    improvements: [
      'Automatische Akkuwarnung für Sensoren',
      'Nachtmodus: Bildschirm dunkel + Energiesparen in einem Zeitfenster',
      'Mehrere Unterdashboards mit Navigations-Karte und automatischem Zurück-Button',
      'Neuer Kartentyp „Energiefluss” im Stil des HA-Energie-Dashboards'
    ]
  },
  {
    version: '1.2.0', date: '2026-07-31', type: 'major',
    title: 'Editor-Umbau: freie Größen, Themes, Screensaver',
    improvements: [
      'Karten frei in Größe und Position ziehbar',
      'Hell/Dunkel-Design nach Sonnenstand',
      'Screensaver als eigenständiges zweites Dashboard',
      'Neue Kartentypen: Gauge, Verlauf, Wind, Regen, Temperatur, Auswahl, Uhr u.a.'
    ]
  },
  {
    version: '1.0.0', date: '2026-07-31', type: 'major',
    title: 'Erste Version',
    improvements: [
      'Setup-Wizard, Karten-Editor, Dashboard-Anzeige im Vollbild',
      'Automatisches Update über GitHub Releases'
    ]
  }
];
