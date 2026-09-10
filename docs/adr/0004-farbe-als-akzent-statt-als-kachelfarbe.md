# 0004 — Farbe als Akzent, nicht als Kachelfarbe

**Status:** angenommen, 2026-09-10

## Zusammenhang

Sieben Kartentypen waren deckend eingefärbt: Klima blau, Lampe orange, Rollladen grün, Wind
türkis, Regen blaugrau, Luftdruck violett, Temperatur ein Verlauf von blau nach rot. Die Farbe
kam aus der Vorlage und ist dort sinnvoll — sie macht den Gerätetyp auf einen Blick erkennbar.

Seit 1.5.0 liegt hinter den Karten aber das Design „Ankunft": ein weicher Farbwolken-Verlauf,
über den sich Karten als mattiertes Glas legen. Die eingefärbten Kacheln überschrieben diese
Glasfläche mit deckender Farbe und stanzten sich hindurch.

Der Nutzer hat das so beschrieben: „Es wirkt sehr bastelhaft, nicht professionell, aber ich
kann ja auch nicht sagen, wie ich es eigentlich haben möchte." Genau das ist die Beschreibung
eines Stilbruchs — nicht eines einzelnen Fehlers, sondern zweier Gestaltungssprachen auf einer
Fläche.

Dazu kam ein zweiter Bruch, den man einzeln kaum bemerkt: Der Aufbau war je Kartentyp anders.
Bei manchen Karten stand der Name über dem Wert, bei anderen darunter; Wind, Regen und Druck
waren zentriert, alles andere linksbündig; Ein/Aus hieß je nach Karte `ON`, `An` oder `AN`.
Nebeneinander an einer Wand liest sich das wie zusammengesammelt.

## Entscheidung

**Jede Karte ist dieselbe Glasfläche.** Die Farbe des Geräts erscheint als Akzent, gesetzt über
`--kachel-akzent`:

- das Symbol trägt die Farbe
- der Regler wird in ihr gefüllt
- ist das Gerät an, legt `.ist-aktiv` einen weichen Schein von oben über die Karte

**Ein Aufbau für alle Karten:** Symbolzeile oben (Symbol links, Zustand rechts), darunter der
Wert groß und in leichtem Schnitt, darunter der Name als Bildunterschrift, ganz unten die
Bedienelemente. Linksbündig, ausnahmslos.

Die Temperaturfarbe bleibt erhalten, ist aber jetzt eine einzelne Farbe (`tempAkzent`) statt
eines Verlaufs zum Fluten.

## Folgen

Der Gerätetyp ist etwas weniger plakativ zu erkennen als vorher — eine orange Kachel sieht man
über den Raum, ein oranges Symbol nicht ganz so weit. Dafür ist das Panel als Ganzes ruhig, und
die Karte, die gerade *an* ist, sticht jetzt tatsächlich heraus. Vorher war jede Karte gleich
laut, weshalb keine auffiel.

Wer die Kachelfarben zurückwill, setzt sie über ein importiertes Design mit `extraCss` wieder
ein — der Weg dafür steht offen und ist nicht versperrt worden.

`--kachel-akzent` ist ab jetzt die einzige Stelle, an der eine Karte Farbe bekommt. Wer einen
neuen Kartentyp baut, setzt dort eine Farbe und bekommt Symbol, Regler und Schein umsonst. Wer
statt dessen `background` auf der Karte setzt, bricht wieder aus — genau das war der Fehler,
der hier behoben wurde.

Zum Prüfen liegt `.scratch/karten-design/vorschau.html` bereit: dieselbe CSS-Datei, dasselbe
Render-Modul, erfundene Zustände. Damit lässt sich das Aussehen im Browser ansehen, ohne Home
Assistant, ohne Electron und ohne aufs Gerät zu müssen. Ein Design ohne Hinsehen zu ändern ist
Raten.
