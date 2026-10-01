'use strict';

// module SpotPrices.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');


class PriceRange {
    constructor({price, unit = "ct/kWh", start, end}) {
        this.price = price;
        this.unit = unit;
        this.start = start;
        this.end = end;
    }

    toString() {
        return `${this.price} ${this.unit} from ${this.start.toLocaleString()} to ${this.end.toLocaleString()}`;
    }

    toJSON() {
        return {
            price: this.price,
            unit: this.unit,
            start: this.start.toISOString(),
            end: this.end.toISOString(),
            __formatOutput: this.toString()
        };
    }
}

class SpotPrices {
    #cachedFilePath = undefined;

    #spotpricedata = undefined;
    #updateTimestamp = undefined;

    #unit = undefined;

    #priceRanges = undefined;

    /**
     * Create a new SpotPrices instance and read cached prices from disk if available
     */
    constructor() {
        this.#cachedFilePath = path.join(
                    __dirname,
                    'spotPricesCache.json');

        this.#readCachedPrices();
    }

    /*
        * Returns true if the instance has spot price data, else false
    */        
    get hasData() { return !(this.#spotpricedata === undefined); }

    /**
     * Returns an array of objects with price, start and end of the price range for each element.
     */
    get priceRanges() { 
        return this.#priceRanges;
    }

    /**
     * Filter an array of price ranges by date range.
     * @param {priceRange[]} priceRanges - Array of price ranges to filter.
     * @param {string} [from] - Optional start date in ISO 8601 format (inclusive).
     * @param {string} [to] - Optional end date in ISO 8601 format (inclusive).
     * @returns {priceRange[]} - Filtered array of price ranges.
     */
    filterPriceRangesByDate(priceRanges, from, to) {
        let startDate = from ? new Date(from) : undefined;
        let endDate = to ? new Date(to) : undefined;

        if (!startDate && !endDate) {
            return priceRanges;
        }

        if (startDate && endDate && startDate > endDate) {
            throw new Error("Start date must be less than or equal to end date.");
        }

        // Filter ranges where the start date is >= from and <= to.
        return priceRanges.filter(range => {
            const startIsAfterOrEqualFrom = !(from && !isNaN(startDate)) || range.start >= startDate;
            const endIsBeforeTo = !(to && !isNaN(endDate)) || range.end <= endDate;
            return startIsAfterOrEqualFrom && endIsBeforeTo;
        });
    }

    /**
     * Unit of spot prices (usually ct/kWh)
     */
    get unit() { return this.#unit; }

    /**
     * Timestamp when the spot prices were updated (Date)
     */
    get updateTimestamp() { return new Date(this.#updateTimestamp); }


    /**
     * Returns the first Date in the dataset
     */
    get minDate() { return this.#priceRanges[0].start; }
    /**
     * Returns the last Date in the dataset
     */
    get maxDate() { return this.#priceRanges[this.#priceRanges.length - 1].end; }

    /**
     * Returns start and end Date for today: (00:00:00 and 23:59:59)
     */
    get _todayDates() {
        const now = new Date();
        const start = new Date(now.setHours(0, 0, 0, 0));
        const end = new Date(now.setHours(23, 59, 59, 999));
        return {start: start, end: end};
    }

    /**
     * Returns start and end Date for tomorrow: (00:00:00 and 23:59:59)
     */
    get _tomorrowDates() {
        const tomorrow = new Date();
        tomorrow.setDate(new Date().getDate() + 1);
        const start = new Date(tomorrow.setHours(0, 0, 0, 0));
        const end = new Date(tomorrow.setHours(23, 59, 59, 999));
        return {start: start, end: end};
    }

    /**
     * Returns the minimum priceRange for today
     */
    get todayMinPriceRange() { 
        const todayPrices = this.filterPriceRangesByDate(this.#priceRanges,
            this._todayDates.start.toISOString(),
            this._todayDates.end.toISOString());

        if (todayPrices.length === 0) {
            throw new Error("No prices available for today.");
        }

        let minItem;
        for (const item of todayPrices) {
            if (!minItem || item.price < minItem.price) {
                minItem = item;
            }
        }
        return minItem;
    }

    /**
     * Returns the maximum priceRange for today
     */
    get todayMaxPriceRange() { 
        const todayPrices = this.filterPriceRangesByDate(this.#priceRanges,
            this._todayDates.start.toISOString(),
            this._todayDates.end.toISOString());

        if (todayPrices.length === 0) {
            throw new Error("No prices available for today.");
        }
        
        let maxItem;
        for (const item of todayPrices) {
            if (!maxItem || item.price > maxItem.price) {
                maxItem = item;
            }
        }
        return maxItem;
    }

    /**
     * Current spot price range
     */
    get currentPriceRange() {
        const now = new Date();
        const nowPriceRange = this.#priceRanges.find(range => range.start <= now && range.end > now);
        if (!nowPriceRange) {
            throw new Error("No current price available.");
        }
        return nowPriceRange;
    }

    /**
     * Does the current dataset contain tomorrow's spot prices?
     */
    get hasTomorrowsPrices() {
        // No data → false
        if (!this.#priceRanges || this.#priceRanges.length === 0) return false;

        return this.maxDate >= this._tomorrowDates.end;
    }

    /**
     * Fetch spot prices, save to cache and update internal variables
     * The range of data fetched goes back <daysBack> at 00:00:00 and
     * forward <daysForward> at 23:59:59
     * 
     * Throws error on failure
     * 
     * @param {number} daysBack
     * @param {number} daysForward 
     */
    async updateSpotPricesAsync(daysBack = 1, daysForward = 1) {
        const now = new Date();

        const startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - daysBack);
        const start = startDate.toISOString();

        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        endDate.setDate(endDate.getDate() + daysForward);
        const end = endDate.toISOString();

        const spotPricesUrl = `https://api.energy-charts.info/price?bzn=DE-LU&start=${start}&end=${end}`;

        try {
            const res = await axios.get(spotPricesUrl, { timeout: 30000 }); // Spot prices API can be slow
            console.debug(`Got spot price data`);

            res.data.updateTimestamp = now;

            await this.#writeCachedPricesAsync(res.data);

            this.#readCachedPrices();
        } catch(error) {
            console.error(`Request for spot prices from ${spotPricesUrl} returned error:`, error);
            throw error;
        }
    }

    /**
     * Read cached raw spot prices and create price ranges from them
     * @returns true if cached prices were read, else false
     */
     #readCachedPrices() {
        try {
            fs.accessSync(this.#cachedFilePath);
            const data = fs.readFileSync(this.#cachedFilePath, 'utf8');
            this.#spotpricedata = JSON.parse(data);

            if (this.#spotpricedata.unit != "EUR / MWh")
                throw "Unit returned by spotprices.info has changes - no longer 'EUR / MWh'";

            this.#unit = "ct/kWh";

            this.#updateTimestamp = this.#spotpricedata.updateTimestamp;

            this.#priceRanges = [];
            for (let i = 0; i < this.#spotpricedata.price.length; i++) {
                const price = Math.round(this.#spotpricedata.price[i]) / 10;
                const start = new Date(this.#spotpricedata.unix_seconds[i] * 1000);
                const end = new Date((this.#spotpricedata.unix_seconds[i] + 15 * 60) * 1000);

                this.#priceRanges.push(new PriceRange({price: price, unit: this.#unit, start: start, end: end}));
            }

            const options = {
                weekday: 'short',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Europe/Berlin'
            }
            console.log(`Read ${this.#priceRanges.length} spot price ranges from cache (${this.#priceRanges[0].start.toLocaleString("de-DE", options)} to ${this.#priceRanges[this.#priceRanges.length - 1].end.toLocaleString("de-DE", options)})`);
            return true;
        } catch (error) {
            if (error && error.code !== 'ENOENT') {
                console.error("Error reading saved spot prices:", error);
            }
        }
        console.log(`No cached spot prices found`);
        return false;
    }

    /**
     * Write raw spot prices to cache
     * @param {*} spotPriceData 
     */
    async #writeCachedPricesAsync(spotPriceData) {
        try {
            await fs.promises.writeFile(this.#cachedFilePath, JSON.stringify(spotPriceData), { encoding: 'utf-8' });
        } catch (error) {
            console.error("Error saving spot prices:", error);
            throw error;
        }
    }
}

module.exports = SpotPrices;
