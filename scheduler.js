'use strict';

const SpotPrices = require('./SpotPrices');

const spot = new SpotPrices();

const RETRY_MS = 10 * 60 * 1000;
const UPDATE_HOUR = 17;

let running = false;
let timer = null;

async function refresh() {
    if (running) return;
    running = true;
    try {
        await spot.updateSpotPricesAsync(1, 1);
    } catch (error) {
        console.error('Spot price update failed, keeping cached data.');
    } finally {
        running = false;
    }
}

/** Sind die Daten aktuell genug fuer den heutigen Tag? */
function needsUpdate(now) {
    if (!spot.hasData) return true;
    const dayStart = spot._todayDates.start;
    if (spot.minDate > dayStart || spot.maxDate < spot._todayDates.end) return true;
    // Ab 17:00 werden die Preise fuer morgen erwartet
    if (now.getHours() >= UPDATE_HOUR && !spot.hasTomorrowsPrices) return true;
    return false;
}

async function tick() {
    const now = new Date();
    if (needsUpdate(now)) {
        await refresh();
    }
    // Vor 17:00 nur alle 10 Minuten pruefen (billig, da nur lokale Pruefung); ab 17:00 bis Erfolg erneut versuchen
    timer = setTimeout(tick, RETRY_MS);
}

function start() {
    if (timer) return;
    tick();
}

module.exports = { spot, start };
