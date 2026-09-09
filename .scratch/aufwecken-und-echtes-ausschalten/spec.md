# Echtes Ausschalten und Aufwecken zum Kalendertermin

Status: erfasst, nicht entschieden, nicht gebaut.
Erfasst am 2026-09-09, nachdem Q12 gestellt, aber vom Nutzer zurueckgestellt wurde:
zuerst wird Version 1.0.0 auf dem Zielgeraet getestet.

## Was der Nutzer will

1. **Wirklich aus, nicht nur dunkel.** Nicht nur die Hintergrundbeleuchtung abschalten
   (das ist der heutige Stand ueber SC_MONITORPOWER), sondern das Geraet selbst
   ausschalten -- und ausdruecklich nicht bloss in den Ruhezustand legen.
2. **Selbsttaetiger Start zum Termin, ohne Anmeldung.** Sobald ein passender
   Kalendereintrag beginnt, soll das Geraet hochkommen und das Wall Display zeigen,
   ohne dass sich jemand bei Windows anmelden muss.
3. **Seltener abfragen.** Statt alle zwei Minuten nur noch stuendlich oder alle zwei
   Stunden nachsehen.
4. **Zusaetzlich ein Weg von aussen.** Eine Home-Assistant-Automatisierung soll dem
   Geraet mitteilen koennen, dass ein Eintrag vorliegt -- und es damit zugleich aufwecken.
   Push soll den Abruf nicht ersetzen, sondern ergaenzen.

## Warum das nicht einfach eine Einstellung ist

Punkt 1 und 2 widersprechen sich mit dem heutigen Entwurf: Die Steuerung lebt im
laufenden Programm. Ein ausgeschaltetes Geraet fuehrt nichts aus und kann sich nicht
selbst wecken. Wer das will, verlagert den Ausloeser zwingend nach aussen -- also auf
Punkt 4 -- und macht ihn damit vom Ergaenzungs- zum Hauptweg.

Offene Punkte, die vor einer Entscheidung geklaert sein muessen:

- **Weckfaehigkeit des Geraets.** Surface Go nutzt Modern Standby (S0ix). Aus dem
  vollstaendig ausgeschalteten Zustand (S5) weckt weder eine geplante Aufgabe noch ein
  Netzwerkpaket, solange das nicht in der Firmware und am Netzwerkadapter ausdruecklich
  unterstuetzt und aktiviert ist. Muss am echten Geraet geprueft werden.
- **Anmeldung ohne Passwort.** Punkt 2 verlangt eine automatische Windows-Anmeldung.
  Der uebliche Weg legt das Passwort in der Registry ab. Das ist eine bewusste
  Abwaegung, keine Nebensache, und gehoert dem Nutzer vorgelegt.
- **Punkt 3 kollidiert mit Punkt 1.** Ein stuendlicher Abruf heisst: bis zu eine Stunde
  Verzug, wenn ein Termin beginnt. Vertretbar nur, wenn der Push aus Punkt 4 der
  eigentliche Ausloeser ist und der Abruf nur noch die Selbstheilung nach Ausfaellen
  uebernimmt. Damit kehrt sich die Begruendung von ADR 0002 um -- das ADR waere
  fortzuschreiben, nicht stillschweigend zu unterlaufen.
- **Wie erreicht Home Assistant ein ausgeschaltetes Geraet?** Wake-on-LAN setzt einen
  Adapter voraus, der im ausgeschalteten Zustand lauscht. Beim Surface haengt das am
  Dock bzw. am USB-Ethernet-Adapter.

## Vorher zu klaeren

Q12 ist unbeantwortet: Darf der PC schlafen, und wer weckt ihn? Erst danach ist
entscheidbar, ob 1 und 2 ueberhaupt erreichbar sind oder ob es auf "Geraet laeuft
durch, nur das Panel schaltet" hinauslaeuft.
