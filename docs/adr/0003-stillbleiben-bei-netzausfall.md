# Bei Netzausfall stillbleiben statt alarmieren

Ist Home Assistant nicht erreichbar, behält die Anwendung den letzten bekannten Zustand bei und
zeigt nach drei fehlgeschlagenen Abrufen in Folge eine Vollbild-Fehlerseite — aber nur, wenn das
Panel ohnehin an ist. Ein Netzausfall schaltet das Panel also niemals ein.

Das sieht im Code wie ein vergessener Fall aus, ist aber Absicht: ein Wandpanel, das sich wegen
eines Routerneustarts um drei Uhr nachts selbst einschaltet, ist genau das Verhalten, das dieses
Projekt beseitigen soll. Die Fehlerseite erfüllt ihren Zweck trotzdem, denn wer auf das Panel
schaut, tut das während eines Anzeigefensters. Alle Fehler werden zusätzlich protokolliert.
