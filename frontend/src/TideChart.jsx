import React, { useEffect, useState, useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea
} from 'recharts';
import { format, addHours, subHours, startOfDay, addDays, isSameDay, addMinutes, differenceInMinutes, isWithinInterval, setHours, setMinutes } from 'date-fns';

const TideChart = () => {
    const [location, setLocation] = useState('pc'); // 'pc' = Port Chalmers, 'dn' = Dunedin
    const [originalData, setOriginalData] = useState([]); // Raw HW/LW events
    const [interpolatedData, setInterpolatedData] = useState([]); // Dense 10-min interval data
    const [sunData, setSunData] = useState({}); // { "YYYY-MM-DD": { sunrise: "HH:MM", sunset: "HH:MM" } }
    const [loading, setLoading] = useState(true);

    // State for the Brush
    // We maintain indices for Recharts Brush
    const [brushStart, setBrushStart] = useState(0);
    const [brushEnd, setBrushEnd] = useState(144);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isFullScreen, setIsFullScreen] = useState(false); // Moved to top

    // Fetch Sun Data on Mount
    useEffect(() => {
        fetch('/sunrise_sunset_dn.json')
            .then(res => {
                if (!res.ok) {
                    console.error("Sun data fetch failed:", res.status);
                    return [];
                }
                return res.json();
            })
            .then(data => {
                const map = {};
                data.forEach(item => {
                    map[item.date] = item;
                });
                setSunData(map);
            })
            .catch(err => console.error("Failed to load sun data", err));
    }, []);

    useEffect(() => {
        setLoading(true);
        const filename = location === 'dn' ? '/tides_dn.json' : '/tides_pc.json';

        fetch(filename)
            .then((res) => {
                if (!res.ok) throw new Error("File not found");
                return res.json();
            })
            .then((jsonData) => {
                setOriginalData(jsonData);

                const dense = generateInterpolatedData(jsonData);
                setInterpolatedData(dense);

                setLoading(false);

                // Initialize view to 'now'
                // Ideally we keep the same selectedDate if just switching locations
                const targetDate = new Date(selectedDate);
                jumpToDate(targetDate, dense);
            })
            .catch((err) => {
                console.error("Failed to load tides", err);
                setLoading(false);
                setOriginalData([]);
                setInterpolatedData([]);
            });
    }, [location]);

    // Cosine Interpolation Function
    const interpolate = (y1, y2, mu) => {
        const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
        return (y1 * (1 - mu2) + y2 * mu2);
    };

    const generateInterpolatedData = (events) => {
        if (!events || events.length < 2) return events;

        const denseData = [];
        const intervalMins = 10;
        const intervalMs = intervalMins * 60 * 1000;

        for (let i = 0; i < events.length - 1; i++) {
            const startEvent = events[i];
            const endEvent = events[i + 1];

            const startTime = startEvent.timestamp;
            const endTime = endEvent.timestamp;
            const heightStart = startEvent.height;
            const heightEnd = endEvent.height;

            const durationMs = endTime - startTime;

            // Start at the next "clean" 10-minute mark (or current if already clean)
            let currentTick = Math.ceil(startTime / intervalMs) * intervalMs;

            while (currentTick <= endTime) {
                // Calculate height based on strict interpolation from original event times
                const mu = (currentTick - startTime) / durationMs;
                const h = interpolate(heightStart, heightEnd, mu);

                denseData.push({
                    timestamp: currentTick,
                    height: h,
                    isEvent: false
                });

                currentTick += intervalMs;
            }
        }
        return denseData;
    };


    const findIndexForTime = (targetTime, dataset) => {
        if (!dataset || dataset.length === 0) return 0;
        let low = 0, high = dataset.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (dataset[mid].timestamp < targetTime) low = mid + 1;
            else high = mid - 1;
        }
        return Math.min(Math.max(0, low), dataset.length - 1);
    };

    const jumpToDate = (dateObj, dataset = interpolatedData) => {
        if (dataset.length === 0) return;

        const dayStart = startOfDay(dateObj).getTime();
        const startIdx = findIndexForTime(dayStart, dataset);

        // Window = 3 Days (72 Hours)
        const viewDurationHours = 72;
        const dayEnd = addHours(dateObj, viewDurationHours).getTime();
        const endIdx = findIndexForTime(dayEnd, dataset);

        // ensure range
        const actualStart = Math.max(0, startIdx);
        const actualEnd = Math.min(dataset.length - 1, endIdx);

        setBrushStart(actualStart);
        setBrushEnd(actualEnd);

        setSelectedDate(format(dateObj, 'yyyy-MM-dd'));
    };

    const handleDateChange = (e) => {
        const newDate = new Date(e.target.value);
        if (!isNaN(newDate)) {
            jumpToDate(newDate);
        }
    };

    const toggleLocation = (loc) => {
        if (loc !== location) setLocation(loc);
    };

    const shiftTime = (hours) => {
        if (interpolatedData.length === 0) return;

        const currentDataPoint = interpolatedData[brushStart];
        if (!currentDataPoint) return;

        const currentMs = currentDataPoint.timestamp;
        const targetMs = (hours > 0)
            ? addHours(currentMs, hours).getTime()
            : subHours(currentMs, Math.abs(hours)).getTime();

        const newStartIdx = findIndexForTime(targetMs, interpolatedData);
        const width = brushEnd - brushStart;

        const newEndIdx = Math.min(interpolatedData.length - 1, newStartIdx + width);
        setBrushStart(newStartIdx);
        setBrushEnd(newEndIdx);

        setSelectedDate(format(new Date(interpolatedData[newStartIdx].timestamp), 'yyyy-MM-dd'));
    };

    const handleBrushChange = (e) => {
        if (e.startIndex !== undefined && e.endIndex !== undefined) {
            setBrushStart(e.startIndex);
            setBrushEnd(e.endIndex);

            if (interpolatedData[e.startIndex]) {
                const d = new Date(interpolatedData[e.startIndex].timestamp);
                const dateStr = format(d, 'yyyy-MM-dd');
                if (dateStr !== selectedDate) {
                    setSelectedDate(dateStr);
                }
            }
        }
    };

    // Get Sun times for current selected date
    const getSunTimes = (dateStr) => {
        if (sunData[dateStr]) {
            return sunData[dateStr];
        }

        // Simple heuristic: substitute year 2026 for 2025
        if (dateStr.startsWith('2025')) {
            const mappedDate = dateStr.replace('2025', '2026');
            if (sunData[mappedDate]) {
                return sunData[mappedDate];
            }
        }

        // Fallback
        return { sunrise: "06:00", sunset: "21:00" };
    };

    // Calculate Twilight / Night Intervals for gradual shading
    const twilightIntervals = useMemo(() => {
        if (interpolatedData.length === 0 || brushStart >= brushEnd) return [];

        const startDate = new Date(interpolatedData[brushStart].timestamp);
        const endDate = new Date(interpolatedData[brushEnd].timestamp);

        let current = subDays(startOfDay(startDate), 1);
        const end = addDays(startOfDay(endDate), 1);

        const shadedBlocks = [];

        while (current <= end) {
            const dStr = format(current, 'yyyy-MM-dd');
            // Try to find exact sun data, else default
            const sInfo = getSunTimes(dStr); // Use helper to get mapped data if needed
            const [srH, srM] = sInfo.sunrise.split(':').map(Number);
            const [ssH, ssM] = sInfo.sunset.split(':').map(Number);

            // Sunset logic
            const ssTime = setMinutes(setHours(current, ssH), ssM);
            const nextDay = addDays(current, 1);
            // Sunrise next day 
            const ndStr = format(nextDay, 'yyyy-MM-dd');
            const ndInfo = getSunTimes(ndStr);
            const [nsrH, nsrM] = ndInfo.sunrise.split(':').map(Number);
            const nsrTime = setMinutes(setHours(nextDay, nsrH), nsrM);

            // SUNSET TRANSITION (Sunset -> Sunset + 1h)
            shadedBlocks.push({ x1: ssTime.getTime(), x2: addMinutes(ssTime, 20).getTime(), opacity: 0.1 });
            shadedBlocks.push({ x1: addMinutes(ssTime, 20).getTime(), x2: addMinutes(ssTime, 40).getTime(), opacity: 0.2 });
            shadedBlocks.push({ x1: addMinutes(ssTime, 40).getTime(), x2: addMinutes(ssTime, 60).getTime(), opacity: 0.3 });

            // DEEP NIGHT (Sunset + 1h -> Sunrise - 1h)
            shadedBlocks.push({
                x1: addMinutes(ssTime, 60).getTime(),
                x2: addMinutes(nsrTime, -60).getTime(),
                opacity: 0.45
            });

            // SUNRISE TRANSITION (Sunrise - 1h -> Sunrise)
            const srStart = addMinutes(nsrTime, -60);
            shadedBlocks.push({ x1: srStart.getTime(), x2: addMinutes(srStart, 20).getTime(), opacity: 0.3 });
            shadedBlocks.push({ x1: addMinutes(srStart, 20).getTime(), x2: addMinutes(srStart, 40).getTime(), opacity: 0.2 });
            shadedBlocks.push({ x1: addMinutes(srStart, 40).getTime(), x2: nsrTime.getTime(), opacity: 0.1 });

            current = addDays(current, 1);
        }
        return shadedBlocks;
    }, [interpolatedData, brushStart, brushEnd, sunData]);

    function subDays(date, amount) {
        return addDays(date, -amount);
    }

    if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Loading Tides...</div>;

    const selectedDateObj = new Date(selectedDate);
    const dailyEvents = originalData.filter(d => isSameDay(new Date(d.timestamp), selectedDateObj));
    const dayAvgHeight = dailyEvents.length > 0 ? (dailyEvents[0].avgHeight || 0) : 0;

    let tideStatus = "";
    let tideColor = "#ccc";
    if (dayAvgHeight >= 1.80) {
        tideStatus = "Spring Tide";
        tideColor = "#4ade80";
    } else if (dayAvgHeight > 0) {
        tideStatus = "Neap Tide";
        tideColor = "#facc15";
    }

    const isStrongCurrent = dayAvgHeight > 2.20;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    border: '1px solid #666',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    fontSize: '0.9rem'
                }}>
                    <p className="label" style={{ margin: 0, fontWeight: 'bold', color: '#fff' }}>
                        {format(new Date(label), 'EEE dd MMM, HH:mm')}
                    </p>
                    <p className="intro" style={{ margin: '4px 0 0 0', color: '#4dabf7', fontWeight: 'bold' }}>
                        {`${payload[0].value.toFixed(2)}m`}
                    </p>
                </div>
            );
        }
        return null;
    };

    // State moved to top

    const toggleFullScreen = () => {
        setIsFullScreen(!isFullScreen);
    };

    // Modified Return: Supports Full Screen Overlay
    return (
        <div style={{
            display: 'flex', flexDirection: 'row', // Horizontal Layout
            width: isFullScreen ? '100vw' : '100%',
            height: isFullScreen ? '100vh' : '100%',
            position: isFullScreen ? 'fixed' : 'relative',
            top: isFullScreen ? 0 : 'auto',
            left: isFullScreen ? 0 : 'auto',
            zIndex: isFullScreen ? 9999 : 1,
            background: '#242424',
            borderRadius: isFullScreen ? 0 : '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
            {/* Full Screen Toggle Button (Overlay) */}
            <button
                onClick={toggleFullScreen}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid #666',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                {isFullScreen ? 'Exit Full Screen' : '⤢ Full Screen'}
            </button>
            {/* LEFT SIDEBAR - Controls & Info */}
            <div style={{
                width: '280px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem 1rem',
                background: '#1e1e1e', // Slightly darker sidebar
                borderRight: '1px solid #333',
                overflowY: 'auto',
                gap: '1.5rem',
                alignItems: 'center'
            }}>
                {/* 1. Header & Location */}
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#e0e0e0', lineHeight: '1.4' }}>
                        {location === 'pc' ? 'Port Chalmers' : 'Dunedin'}<br />
                        <span style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 'normal' }}>Tide Prediction</span>
                    </h2>

                    <div style={{ display: 'flex', gap: '0', border: '1px solid #555', borderRadius: '6px', overflow: 'hidden', width: '100%' }}>
                        <button onClick={() => toggleLocation('pc')} style={{ flex: 1, padding: '8px', cursor: 'pointer', background: location === 'pc' ? '#4dabf7' : '#333', color: location === 'pc' ? '#fff' : '#aaa', border: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>PC</button>
                        <button onClick={() => toggleLocation('dn')} style={{ flex: 1, padding: '8px', cursor: 'pointer', background: location === 'dn' ? '#4dabf7' : '#333', color: location === 'dn' ? '#fff' : '#aaa', border: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>DN</button>
                    </div>
                </div>

                {/* 2. Date Controls */}
                <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>SELECTED DATE</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => shiftTime(-24)} style={{ padding: '8px', cursor: 'pointer', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>&lt;</button>
                        <input type="date" value={selectedDate} onChange={handleDateChange} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#333', color: '#fff', textAlign: 'center' }} />
                        <button onClick={() => shiftTime(24)} style={{ padding: '8px', cursor: 'pointer', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>&gt;</button>
                    </div>
                    {/* Date Warning */}
                    {selectedDateObj > new Date('2028-12-31') && (
                        <div style={{ padding: '8px', background: 'rgba(185, 28, 28, 0.2)', border: '1px solid #b91c1c', color: '#fca5a5', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center' }}>
                            ⚠️ No data &gt; 2028
                        </div>
                    )}
                </div>

                {/* 3. Sun & Tide Status */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>☀️ Rise <strong style={{ color: '#fff' }}>{getSunTimes(selectedDate).sunrise}</strong></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🌙 Set <strong style={{ color: '#fff' }}>{getSunTimes(selectedDate).sunset}</strong></span>
                    </div>

                    {tideStatus && (
                        <div style={{ marginTop: '0.5rem', textAlign: 'center', padding: '4px', border: `1px solid ${tideColor}`, borderRadius: '4px', color: tideColor, fontWeight: 'bold', fontSize: '0.9rem' }}>
                            {tideStatus}
                        </div>
                    )}
                    {isStrongCurrent && (
                        <div style={{ textAlign: 'center', padding: '4px', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            ⚠️ Strong Current
                        </div>
                    )}
                </div>

                {/* 4. HW / LW Events List */}
                <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>TIDE EVENTS ({format(selectedDateObj, 'dd MMM')})</label>
                    {dailyEvents.length > 0 ? (
                        dailyEvents.map((ev, i) => {
                            const isHigh = ev.height >= 1.0;
                            return (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: '#2a2a2a', padding: '10px 12px', borderRadius: '6px',
                                    borderLeft: `4px solid ${isHigh ? '#4ade80' : '#f87171'}`
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{format(new Date(ev.timestamp), 'HH:mm')}</span>
                                        <span style={{ fontSize: '0.75rem', color: isHigh ? '#4ade80' : '#f87171' }}>{isHigh ? 'High Water' : 'Low Water'}</span>
                                    </div>
                                    <span style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>{ev.height.toFixed(2)}m</span>
                                </div>
                            )
                        })
                    ) : (
                        <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>No events.</div>
                    )}
                </div>
            </div>

            {/* RIGHT MAIN - Chart Area */}
            {/* Removed internal padding/width constraints to let Flex handle it */}

            {/* Chart Area */}
            <div style={{ width: '100%', flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={interpolatedData.slice(brushStart, brushEnd)}
                        margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4dabf7" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#4dabf7" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        {twilightIntervals.map((block, i) => (
                            <ReferenceArea
                                key={i}
                                x1={block.x1}
                                x2={block.x2}
                                fill="black"
                                fillOpacity={block.opacity}
                                strokeOpacity={0}
                            />
                        ))}

                        <XAxis
                            dataKey="timestamp"
                            domain={['auto', 'auto']}
                            tickFormatter={(unixTime) => format(new Date(unixTime), 'EEE dd HH:mm')}
                            type="number"
                            scale="time"
                            minTickGap={80}
                            tick={{ fill: '#888', fontSize: 12 }}
                            axisLine={{ stroke: '#444' }}
                        />
                        <YAxis
                            domain={[0, 3]}
                            unit="m"
                            tick={{ fill: '#ffffff', fontSize: 12, fontWeight: 'bold' }}
                            ticks={[0, 0.75, 1.5, 2.25, 3]}
                            axisLine={{ stroke: '#ffffff', strokeWidth: 4 }}
                            tickLine={{ stroke: '#ffffff', strokeWidth: 2 }}
                            orientation="left"
                            mirror={true}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area
                            type="monotone"
                            dataKey="height"
                            stroke="#4dabf7"
                            fill="url(#colorHeight)"
                            fillOpacity={1}
                            strokeWidth={4}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TideChart;
