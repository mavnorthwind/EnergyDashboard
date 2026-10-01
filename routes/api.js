'use strict';

const express = require('express');
const CONFIG = require('../public/config');
const { spot } = require('../scheduler');

const router = express.Router();

function slice(ranges, from, to) {
    return ranges.filter(r => r.start >= from && r.start <= to);
}

function toPoints(ranges) {
    return ranges.map(r => ({ start: r.start.toISOString(), end: r.end.toISOString(), price: r.price }));
}

/** Laengstes zusammenhaengendes Fenster, in dem predicate(price) gilt */
function longestWindow(ranges, predicate) {
    let best = null;
    let cur = null;
    for (const r of ranges) {
        if (predicate(r.price)) {
            if (cur && cur.end.getTime() === r.start.getTime()) {
                cur.end = r.end;
            } else {
                cur = { start: r.start, end: r.end };
            }
            if (!best || cur.end - cur.start > best.end - best.start) {
                best = cur;
            }
        } else {
            cur = null;
        }
    }
    return best && { start: best.start.toISOString(), end: best.end.toISOString() };
}

/** Naechstes Fenster (ab jetzt), in dem predicate(price) gilt */
function nextWindow(ranges, predicate, now) {
    const upcoming = ranges.filter(r => r.end > now);
    const first = upcoming.findIndex(r => predicate(r.price));
    if (first < 0) return null;
    let end = upcoming[first].end;
    for (let i = first + 1; i < upcoming.length && predicate(upcoming[i].price) && upcoming[i].start.getTime() === end.getTime(); i++) {
        end = upcoming[i].end;
    }
    return { start: upcoming[first].start.toISOString(), end: end.toISOString() };
}

function extreme(ranges, better) {
    let e = null;
    for (const r of ranges) {
        if (!e || better(r.price, e.price)) e = r;
    }
    return e && { price: e.price, start: e.start.toISOString(), end: e.end.toISOString() };
}

router.get('/dashboard', (req, res) => {
    if (!spot.hasData) {
        return res.status(503).json({ error: 'No spot price data available yet.' });
    }

    const now = new Date();
    const today = spot._todayDates;
    const tomorrow = spot._tomorrowDates;
    const all = spot.priceRanges;

    const todayRanges = slice(all, today.start, today.end);
    const tomorrowRanges = spot.hasTomorrowsPrices ? slice(all, tomorrow.start, tomorrow.end) : [];

    const isLow = p => p <= CONFIG.LOW_THRESHOLD;
    const isHigh = p => p > CONFIG.HIGH_THRESHOLD;

    const current = all.find(r => r.start <= now && r.end > now);

    res.json({
        unit: spot.unit,
        updated: spot.updateTimestamp.toISOString(),
        now: now.toISOString(),
        dayStart: today.start.toISOString(),
        tomorrowStart: tomorrow.start.toISOString(),
        today: toPoints(todayRanges),
        tomorrow: toPoints(tomorrowRanges),
        current: current ? { price: current.price, start: current.start.toISOString(), end: current.end.toISOString() } : null,
        min: extreme(todayRanges, (a, b) => a < b),
        max: extreme(todayRanges, (a, b) => a > b),
        lowWindow: longestWindow(todayRanges, isLow),
        highWindow: longestWindow(todayRanges, isHigh),
        nextLowWindow: nextWindow(slice(all, now, tomorrow.end), isLow, now)
    });
});

module.exports = router;
