# Energy Spot Price Dashboard (800x480)

Dashboard fuer einen Raspberry Pi 4 mit 800x480-Display. Die Preise kommen ueber `Spotprices.js` (energy-charts.info, DE-LU).

## Start

```bash
npm install
npm start          # http://localhost:3000
```

Der Scheduler (`scheduler.js`) prueft alle 10 Minuten, ob der Cache aktuell ist. Ab 17:00 wird so lange neu abgerufen, bis die Preise fuer morgen vorliegen. Diese erscheinen als gelbe Linie im Graph.

## Anpassen

Schwellenwerte, Achsengrenzen und Farben stehen in `public/config.js`:

- `LOW_THRESHOLD` (Standard 0 ct/kWh): gruene Zone
- `HIGH_THRESHOLD` (Standard 20 ct/kWh): rote Zone

## Raspberry Pi

Zeitzone setzen (wichtig fuer die Tagesgrenzen):

```bash
sudo timedatectl set-timezone Europe/Berlin
```

systemd-Service `/etc/systemd/system/energydashboard.service`:

```ini
[Unit]
Description=Energy Dashboard
After=network-online.target

[Service]
WorkingDirectory=/home/pi/EnergyDashboard
ExecStart=/usr/bin/node ./bin/www
Restart=always
User=pi
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now energydashboard
```

Kiosk-Autostart (z. B. `~/.config/autostart/dashboard.desktop` oder LXDE-Autostart):

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito --window-size=800,480 --window-position=0,0 http://localhost:3000
```
