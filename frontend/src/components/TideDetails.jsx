import React, { useMemo } from 'react';

function TideDetails({ tideData, date, time }) {

    const { events, currentStatus, springNeap, graphPoints, currentPoint } = useMemo(() => {
        if (!tideData || !tideData.length || !date || !time) return {};

        // Ensure date is valid
        if (isNaN(new Date(date).getTime())) return {};

        const currentDateTime = new Date(`${date}T${time}`);
        const currentTimestamp = currentDateTime.getTime();

        // 1. Filter events for the DISPLAY LIST (Strictly selected day)
        // Use string matching on e.date ("YYYY-MM-DD HH:MM") to avoid timezone issues with timestamps
        const displayListEvents = tideData.filter(e =>
            e.date.startsWith(date)
        ).sort((a, b) => a.timestamp - b.timestamp);

        // Define day boundaries for graph using the timestamp of the first/last event or derived range
        // We still need numeric range for the graph, but let's base it on the filtered events if possible, 
        // or safer: parse 'date' as local midnight.
        const dayStart = new Date(date + "T00:00:00").getTime();
        const dayEnd = dayStart + 86400000;

        // 2. Find Next/Prev relative to CURRENT TIME for STATUS
        // Use the full dataset to find surrounding events
        let prevEvent = null;
        let nextEvent = null;

        for (let i = 0; i < tideData.length - 1; i++) {
            if (tideData[i].timestamp <= currentTimestamp && tideData[i + 1].timestamp >= currentTimestamp) {
                prevEvent = tideData[i];
                nextEvent = tideData[i + 1];
                break;
            }
        }

        let status = "Unknown";
        let sn = "Unknown";

        if (prevEvent && nextEvent) {
            const isRising = nextEvent.height > prevEvent.height;
            status = isRising ? "Flooding" : "Ebbing";

            // Check nearest High Tide for Spring/Neap
            const highTideEvent = nextEvent.height > prevEvent.height ? nextEvent : prevEvent;

            if (highTideEvent.avgHeight !== undefined) {
                sn = highTideEvent.avgHeight >= 1.8 ? "Spring Tide" : "Neap Tide";
            } else {
                sn = highTideEvent.height >= 2.0 ? "Spring Tide" : "Neap Tide";
            }
        }

        // 3. Generate Graph Points (Cosine Interpolation)
        const points = [];
        for (let t = dayStart; t <= dayEnd; t += 900000) { // 15 min steps
            let idx = tideData.findIndex(e => e.timestamp > t);
            if (idx > 0) {
                const t1 = tideData[idx - 1];
                const t2 = tideData[idx];

                const total = t2.timestamp - t1.timestamp;
                const current = t - t1.timestamp;
                const fraction = current / total;
                const theta = Math.PI * fraction;
                const h = t1.height + (t2.height - t1.height) * (1 - Math.cos(theta)) / 2;

                points.push({ time: t, height: h });
            }
        }

        // 4. Current Point
        let curH = 0;
        if (prevEvent && nextEvent) {
            const total = nextEvent.timestamp - prevEvent.timestamp;
            const current = currentTimestamp - prevEvent.timestamp;
            const fraction = current / total;
            const theta = Math.PI * fraction;
            curH = prevEvent.height + (nextEvent.height - prevEvent.height) * (1 - Math.cos(theta)) / 2;
        }

        return {
            events: displayListEvents,
            currentStatus: status,
            springNeap: sn,
            graphPoints: points,
            currentPoint: { time: currentTimestamp, height: curH }
        };
    }, [tideData, date, time]);

    if (!graphPoints || graphPoints.length === 0) return (
        <div className="card" style={{ padding: '1rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            Tide Data Unavailable
        </div>
    );

    // SVG scaling
    const width = 300;
    const height = 100;
    const padding = 20;
    const minTime = graphPoints[0].time;
    const maxTime = graphPoints[graphPoints.length - 1].time;
    const minH = 0;
    const maxH = 2.5;

    const getX = (t) => padding + ((t - minTime) / (maxTime - minTime)) * (width - 2 * padding);
    const getY = (h) => height - padding - ((h - minH) / (maxH - minH)) * (height - 2 * padding);

    const d = graphPoints.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${getX(p.time)} ${getY(p.height)}`
    ).join(' ');

    return (
        <div className="card" style={{ padding: '0.75rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '1rem' }}>Tide Details ({date})</h3>

            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1, padding: '0.5rem', background: currentStatus === 'Flooding' ? '#eff6ff' : '#fef2f2', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: currentStatus === 'Flooding' ? '#1e40af' : '#991b1b', fontWeight: 'bold' }}>STATE</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: currentStatus === 'Flooding' ? '#1d4ed8' : '#b91c1c' }}>{currentStatus}</div>
                </div>
                <div style={{ flex: 1, padding: '0.5rem', background: '#f0fdf4', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 'bold' }}>TYPE</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#15803d' }}>{springNeap}</div>
                </div>
            </div>

            {/* Graph */}
            <div style={{ flex: 1, minHeight: '100px', marginBottom: '0.75rem', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <path d={d} fill="none" stroke="#3b82f6" strokeWidth="2" />
                    <circle cx={getX(currentPoint.time)} cy={getY(currentPoint.height)} r="4" fill="#ef4444" stroke="white" strokeWidth="2" />
                    <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4" />
                </svg>
                <div style={{ position: 'absolute', bottom: 0, left: 0, fontSize: '0.65rem', color: '#94a3b8' }}>00:00</div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, fontSize: '0.65rem', color: '#94a3b8' }}>24:00</div>
            </div>

            {/* HW / LW List */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.25rem', fontSize: '0.8rem', overflowY: 'auto', maxHeight: '110px' }}>
                {events.map((e, i) => {
                    const t = new Date(e.timestamp);
                    const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    const isHigh = e.height > 1.2;
                    const typeLabel = isHigh ? 'HW' : 'LW';
                    const color = isHigh ? '#1e3a8a' : '#0ea5e9';
                    const bgColor = isHigh ? '#dbeafe' : '#e0f2fe';

                    return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', background: bgColor, borderRadius: '4px', borderLeft: `3px solid ${color}` }}>
                            <span style={{ fontWeight: '600', color: '#475569' }}>{typeLabel}</span>
                            <span style={{ fontWeight: '500', color: '#334155' }}>{timeStr}</span>
                            <span style={{ fontWeight: '700', color: color }}>{e.height.toFixed(1)}m</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default TideDetails;
