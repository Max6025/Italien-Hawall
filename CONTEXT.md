# Italien Wall Display

Ein eigenständiges Windows-Wandpanel für Home Assistant, dessen Anzeige von Kalendereinträgen
gesteuert wird: läuft ein passender Termin, zeigt das Gerät ein Dashboard; läuft keiner, ist der
physische Bildschirm abgeschaltet. Abgeleitet von HA Wall Display, aber ein eigenes Projekt.

## Language

### Kalendersteuerung

**Keyword**:
Ein vom Nutzer eingegebener Suchbegriff. Mehrere Keywords werden kommagetrennt hinterlegt.

**Treffer**:
Ein Kalendereintrag, dessen Titel eines der Keywords enthält (Groß-/Kleinschreibung irrelevant).
Die Beschreibung eines Eintrags wird nie durchsucht.
_Vermeiden_: Match, Fund, Ereignis

**Anzeigefenster**:
Der Zeitraum, in dem der Bildschirm wegen eines Treffers an sein soll: Start und Ende des
Treffers, verschoben um Vorlauf und Nachlauf. Ein Ganztages-Treffer ergibt ein Anzeigefenster
von Mitternacht bis Mitternacht.
_Vermeiden_: Zeitfenster, Termin, Slot

**Vorlauf / Nachlauf**:
Zwei einstellbare Minutenwerte, die das Anzeigefenster nach vorne bzw. hinten verlängern.
Standardwert ist jeweils 0.

### Bildschirmzustand

**Panel**:
Der physische Bildschirm des Geräts, inklusive Hintergrundbeleuchtung.
_Vermeiden_: Monitor, Display, Bildschirm (mehrdeutig, siehe Wall Display)

**Wall Display**:
Die Vollbild-Anwendung auf dem Panel — das, was angezeigt wird, nicht das Gerät, das anzeigt.
_Vermeiden_: App, Kiosk, Frontend

**Panel aus**:
Das Panel ist über Windows stromlos geschaltet, die Hintergrundbeleuchtung ist dunkel.
Abzugrenzen vom Nachtschwarz.
_Vermeiden_: Standby, Schlafmodus, Bildschirmschoner

**Nachtschwarz**:
Der Zustand aus HA Wall Display, bei dem ein schwarzes Overlay über dem Wall Display liegt und
die Helligkeit abgesenkt ist, das Panel aber weiter leuchtet. In diesem Projekt ausdrücklich
kein Ersatz für Panel aus.

**Nachtsperre**:
Ein wiederkehrendes Uhrzeit-Fenster, in dem das Panel aus bleibt, auch wenn ein Anzeigefenster
läuft. Hat immer Vorrang vor der Kalendersteuerung.
_Vermeiden_: Nachtmodus (heißt in HA Wall Display etwas anderes)

### Schutzmechanismen

**Wächter**:
Die wiederkehrende Prüfung, die das Panel erneut abschaltet, wenn es außerhalb eines
Anzeigefensters durch eine Eingabe aufgeweckt wurde.
_Vermeiden_: Watchdog, Loop, Timer

**Pause**:
Ein zeitlich begrenzter Zustand, in dem der Wächter nicht abschaltet, damit das Gerät bedient
werden kann. Endet von selbst.
_Vermeiden_: Not-Aus, Override, Wartungsmodus

**Karenzzeit**:
Eine Spanne nach dem Start der Anwendung, in der nie abgeschaltet wird.

**Zugangscode**:
Das Geheimnis, das die Setup-Oberfläche gegen unbefugte Zugriffe aus dem lokalen Netz schützt.
_Vermeiden_: Passwort, PIN, Token (Token meint hier immer den Home-Assistant-Zugang)
