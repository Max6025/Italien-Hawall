# Eigenes Projekt statt Einstellung in HA Wall Display

Die Kalendersteuerung hätte auch eine zusätzliche Einstellung in HA Wall Display sein können,
statt eines zweiten Repositories mit vollständiger Kopie des Codes. Wir haben uns bewusst für
ein eigenes Projekt entschieden: eigener Produktname, eigene `appId`, eigener Setup-Port und ein
eigener Auto-Update-Kanal, sodass beide Anwendungen auf demselben Gerät nebeneinander laufen
können, ohne sich Konfiguration oder Installation zu überschreiben.

## Consequences

Beide Codebasen driften auseinander. Jede Verbesserung an Karten, Editor oder Home-Assistant-
Anbindung muss künftig zweimal gemacht oder von Hand übertragen werden. Das ist der bewusst in
Kauf genommene Preis für die Unabhängigkeit — kein Versehen. Wer diesen Aufwand später nicht
mehr tragen will, sollte die Projekte zusammenführen und die Kalendersteuerung zu einer
abschaltbaren Einstellung machen, statt die Kopien weiter zu pflegen.
