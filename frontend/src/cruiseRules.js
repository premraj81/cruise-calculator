
// Logic ported from backend/calculator.py to run purely in frontend

export function calculateCruiseWindows(tideEvents, shipType, movement, targetDateStr) {
    console.log("Calc Cruise for:", targetDateStr, shipType, movement);

    if (!tideEvents || tideEvents.length === 0) {
        return {
            date: targetDateStr,
            windows: [],
            message: "Tide data not loaded."
        };
    }

    // Filter events for the specific day to mimic backend logic
    // Python code finds "daily_events" first.
    // Tides JSON dates are "YYYY-MM-DD HH:mm".
    const dailyEvents = tideEvents.filter(e => e.date && e.date.startsWith(targetDateStr));
    console.log("Daily events found:", dailyEvents.length);

    if (dailyEvents.length === 0) {
        return {
            date: targetDateStr,
            windows: [],
            message: "No tide events found for this date."
        };
    }

    // Determine H/L based on height (Heuristic: > 1.2m is High)
    // Map to a richer object if needed, but we can just use the raw event + inferred type
    const enrich = (e) => ({
        ...e,
        dt: new Date(e.timestamp), // JS Date object
        type: e.height >= 1.2 ? 'HW' : 'LW'
    });

    const enrichedDaily = dailyEvents.map(enrich);
    const allEnriched = tideEvents.map(enrich); // Need full list for "Next Event" search
    console.log("Enriched Daily Types:", enrichedDaily.map(e => e.type));

    const st = shipType.toLowerCase();
    const mv = movement.toLowerCase();
    const windows = [];

    // --- RULES ---

    // 1. Ovation Departure
    if (st.includes('ovation') && mv.includes('departure')) {
        return {
            date: targetDateStr,
            windows: [],
            message: "Ovation Class can depart any time."
        };
    }

    // 2. Arrival
    if (mv.includes('arrival')) {
        // "Window Opens at Exactly HW... Closes 1 Hr before LW"
        const hwEvents = enrichedDaily.filter(e => e.type === 'HW');

        hwEvents.forEach((hw, i) => {
            // Find Next LW in the FULL list (might be tomorrow)
            // Ideally we find the index of 'hw' in 'allEnriched' and search forward
            const hwIndex = allEnriched.findIndex(e => e.timestamp === hw.timestamp);
            let nextLw = null;

            if (hwIndex !== -1) {
                for (let j = hwIndex + 1; j < allEnriched.length; j++) {
                    if (allEnriched[j].type === 'LW') {
                        nextLw = allEnriched[j];
                        break;
                    }
                }
            }

            if (nextLw) {
                const rawOpen = new Date(hw.dt);
                const rawClose = new Date(nextLw.dt.getTime() - 60 * 60 * 1000); // Mines 1 hour

                const openTime = roundTime(rawOpen, 'up');
                const closeTime = roundTime(rawClose, 'down');

                if (closeTime > openTime) {
                    windows.push({
                        window_id: i + 1,
                        open: toLocalISO(openTime),
                        close: toLocalISO(closeTime),
                        basis: `HW at ${formatTime(hw.dt)} -> LW at ${formatTime(nextLw.dt)}`
                    });
                }
            }
        });
    }

    // 3. Princess Departure
    else if (st.includes('princess') && mv.includes('departure')) {
        // "Opens LW + 30mins ... Closes 1 Hr after HW"
        const lwEvents = enrichedDaily.filter(e => e.type === 'LW');

        lwEvents.forEach((lw, i) => {
            // Find Next HW
            const lwIndex = allEnriched.findIndex(e => e.timestamp === lw.timestamp);
            let nextHw = null;

            if (lwIndex !== -1) {
                for (let j = lwIndex + 1; j < allEnriched.length; j++) {
                    if (allEnriched[j].type === 'HW') {
                        nextHw = allEnriched[j];
                        break;
                    }
                }
            }

            if (nextHw) {
                const rawOpen = new Date(lw.dt.getTime() + 30 * 60 * 1000); // Plus 30 mins
                const rawClose = new Date(nextHw.dt.getTime() + 60 * 60 * 1000); // Plus 1 hour

                const openTime = roundTime(rawOpen, 'up');
                const closeTime = roundTime(rawClose, 'down');

                if (closeTime > openTime) {
                    windows.push({
                        window_id: i + 1,
                        open: toLocalISO(openTime),
                        close: toLocalISO(closeTime),
                        basis: `LW at ${formatTime(lw.dt)} -> Next HW at ${formatTime(nextHw.dt)}`
                    });
                }
            }
        });
    }

    if (windows.length === 0) {
        return {
            date: targetDateStr,
            windows: [],
            tides: formatTidesList(enrichedDaily),
            message: "No applicable tide events / no window available for this date."
        };
    }

    return {
        date: targetDateStr,
        windows: windows,
        tides: formatTidesList(enrichedDaily),
        message: null
    };
}

// --- Helpers ---

function roundTime(dateObj, direction, interval = 15) {
    const d = new Date(dateObj);
    const minutes = d.getMinutes();
    const remainder = minutes % interval;

    // Reset seconds/ms
    d.setSeconds(0);
    d.setMilliseconds(0);

    if (remainder === 0) return d;

    if (direction === 'up') {
        const add = interval - remainder;
        d.setMinutes(minutes + add);
    } else {
        d.setMinutes(minutes - remainder);
    }
    return d;
}

function formatTime(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function formatTidesList(events) {
    return events.map(e => ({
        time: formatTime(e.dt),
        height: e.height,
        type: e.type
    }));
}

// Emulate Python isoformat (Local Time string)
function toLocalISO(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${h}:${m}:${s}`;
}
