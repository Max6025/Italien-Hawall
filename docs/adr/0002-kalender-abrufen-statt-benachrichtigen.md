# Kalender abrufen statt sich benachrichtigen lassen

Die Anwendung fragt den Kalender alle zwei Minuten selbst über die Home-Assistant-REST-API ab,
statt sich von einer HA-Automation per Webhook anstoßen zu lassen. Push wäre effizienter und
reaktionsschneller, versagt aber genau in den Fällen, die bei einem Wandgerät real vorkommen:
der PC war beim Beginn des Termins aus, das WLAN war kurz weg, oder Home Assistant wurde neu
gestartet. Ein verpasster Anstoß wird nie nachgeholt, ein verpasster Abruf schon.

Der Abruf über die REST-API funktioniert außerdem mit jeder Kalender-Integration in Home
Assistant (Google, Local Calendar, CalDAV, …), ohne dass die Anwendung das dahinterliegende
System kennen muss.
