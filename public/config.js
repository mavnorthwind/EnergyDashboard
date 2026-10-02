'use strict';

// Gemeinsame Konfiguration (Browser und Node.js)
const CONFIG = {
    LOW_THRESHOLD: 10,     // ct/kWh: Preise <= Wert sind "gruen"
    HIGH_THRESHOLD: 25,   // ct/kWh: Preise > Wert sind "rot"
    Y_MIN: 0,           // Standard-Achsengrenzen (werden bei Bedarf erweitert)
    Y_MAX: 30,
    Y_STEP: 10,
    TIMEZONE: 'Europe/Berlin',
    LOCALE: 'de-DE',
    RELOAD_MS: 1 * 60 * 1000,
    TICK_MS: 30 * 1000,
    COLORS: {
        line: '#4a9eff',
        tomorrow: '#ffd43b',
        low: '#5cb85c',
        high: '#f0883e'
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
