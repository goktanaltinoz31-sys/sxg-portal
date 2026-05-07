SXG Portal Complete v4

Das ist das EINZIGE Paket, das du jetzt verwenden sollst.

Enthalten:
- GPS-Check-in mit Radius
- Live-Tracking nur für Admin
- Mitarbeiter sehen keine Standorte anderer Mitarbeiter
- Admin kann jeden Mitarbeiter einzeln tracken
- Push-Backend
- Fahrpläne
- Chat
- Prämien
- Stundenlohn
- automatische Lohnberechnung
- AU-Upload
- Lohnabrechnungen
- Kalender vor/zurück

Reihenfolge:
1. sxg-v4-upgrade.sql in Supabase SQL Editor ausführen.
2. GitHub: index.html ersetzen.
3. GitHub: sw.js hochladen.
4. GitHub: Ordner api erstellen und send-push.js hineinlegen.
5. GitHub: package.json ersetzen.
6. GitHub: vercel.json hochladen.
7. VAPID_PUBLIC_KEY in index.html ersetzen.
8. Vercel ENV setzen:
   VAPID_PUBLIC_KEY
   VAPID_PRIVATE_KEY
   VAPID_SUBJECT=mailto:info@nur-sxg-service.de

VAPID Keys erzeugen:
https://web-push-codelab.glitch.me/


V5: Admin Live-Lohn mit Monatsübersicht, Mitarbeiterdetails, Tagesaufschlüsselung, Kreisdiagramm und Prämienübersicht.
