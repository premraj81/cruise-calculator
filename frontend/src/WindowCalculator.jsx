import React, { useState, useEffect } from 'react';
import { calculateCruiseWindows } from './cruiseRules';

function WindowCalculator({ shipType, setShipType, movement, setMovement, dates, setDates, results, setResults }) {

    // Load Tides Data locally
    const [tideData, setTideData] = useState([]);
    const [loadingTides, setLoadingTides] = useState(true);
    const [tideError, setTideError] = useState(null);

    useEffect(() => {
        fetch('/tides_pc.json')
            .then(res => {
                if (!res.ok) throw new Error("Failed to load tides");
                return res.json();
            })
            .then(data => {
                setTideData(data);
                setLoadingTides(false);
            })
            .catch(err => {
                console.error("Error loading tides_pc.json:", err);
                setTideError("Failed to load tide database.");
                setLoadingTides(false);
            });
    }, []);

    const handleToggleChange = (type, value) => {
        if (type === 'ship') setShipType(value);
        if (type === 'movement') setMovement(value);
        setResults({});
    };

    const handleDateChange = (index, value) => {
        const newDates = [...dates];
        newDates[index] = value;
        setDates(newDates);
        if (results[index]) {
            const newResults = { ...results };
            delete newResults[index];
            setResults(newResults);
        }
    };

    const addDate = () => {
        if (dates.length < 10) {
            setDates([...dates, '']);
        }
    };

    const removeDate = (index) => {
        const newDates = dates.filter((_, i) => i !== index);
        setDates(newDates);
        const newResults = { ...results };
        delete newResults[index];
        setResults({});
    };

    const calculateRow = (index) => {
        const date = dates[index];
        if (!date) return;

        if (loadingTides) {
            alert("Tide database still loading...");
            return;
        }
        if (tideError) {
            setResults(prev => ({
                ...prev,
                [index]: { error: tideError }
            }));
            return;
        }

        // Perform Calculation Locally
        const result = calculateCruiseWindows(tideData, shipType, movement, date);

        setResults(prev => ({
            ...prev,
            [index]: result
        }));
    };

    return (
        <div className="window-calculator">
            {loadingTides && <div style={{ textAlign: 'center', padding: '10px', color: '#666' }}>Loading Tide Database...</div>}

            <div className="controls">
                <div className="control-group">
                    <label className="control-label">Ship Type</label>
                    <div className="toggle-group">
                        <button
                            className={`toggle-btn ${shipType === 'princess' ? 'active' : ''}`}
                            onClick={() => handleToggleChange('ship', 'princess')}
                        >
                            Princess Class
                        </button>
                        <button
                            className={`toggle-btn ${shipType === 'ovation' ? 'active' : ''}`}
                            onClick={() => handleToggleChange('ship', 'ovation')}
                        >
                            Ovation Class
                        </button>
                    </div>
                </div>

                <div className="control-group">
                    <label className="control-label">Movement</label>
                    <div className="toggle-group">
                        <button
                            className={`toggle-btn ${movement === 'arrival' ? 'active' : ''}`}
                            onClick={() => handleToggleChange('movement', 'arrival')}
                        >
                            Arrival
                        </button>
                        <button
                            className={`toggle-btn ${movement === 'departure' ? 'active' : ''}`}
                            onClick={() => handleToggleChange('movement', 'departure')}
                        >
                            Departure
                        </button>
                    </div>
                </div>
            </div>

            <div className="date-list">
                {dates.map((date, index) => {
                    const isCalculated = !!results[index];
                    return (
                        <div key={index} className="date-row">
                            <div className="date-input-container">
                                <label className="date-label">Date {index + 1}</label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <input
                                        type="date"
                                        className="date-input"
                                        value={date}
                                        onChange={(e) => handleDateChange(index, e.target.value)}
                                        style={{ marginBottom: 0 }}
                                    />
                                    {dates.length > 1 && (
                                        <button className="remove-btn" onClick={() => removeDate(index)}>×</button>
                                    )}
                                </div>

                                <button
                                    onClick={() => calculateRow(index)}
                                    disabled={!date}
                                    className="row-calc-btn"
                                    style={{
                                        backgroundColor: isCalculated ? '#facc15' : '#ffffff',
                                        color: isCalculated ? '#000000' : '#475569',
                                        borderColor: isCalculated ? '#eab308' : '#cbd5e1'
                                    }}
                                >
                                    {isCalculated ? '✓ Calculated' : 'Calculate Window'}
                                </button>
                            </div>

                            <div className="result-container">
                                {results[index] && (
                                    <ResultDisplay
                                        result={results[index]}
                                        config={{ shipType, movement }}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}

                {dates.length < 10 && (
                    <div className="add-date-container">
                        <button className="add-btn" onClick={addDate}>
                            + Add Date
                        </button>
                        <span style={{ fontSize: '1rem', color: '#64748b', marginLeft: '1rem', fontWeight: 'bold' }}>
                            ({10 - dates.length} available)
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ResultDisplay({ result, config }) {
    if (!result) return null;
    if (result.error) return <p className="msg-error">{result.error}</p>;
    if (result.message && (!result.windows || result.windows.length === 0)) {
        return <p className="msg-info">{result.message}</p>;
    }

    const targetDateStr = result.date;
    const shipText = config.shipType === 'princess' ? 'Princess Class' : 'Ovation Class';
    const moveText = config.movement === 'arrival' ? 'Arrival' : 'Departure';
    const headerText = `${shipText} ${moveText} Window`;

    return (
        <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1rem', textAlign: 'center', paddingLeft: '2rem' }}>
                {headerText}
            </h4>
            {result.message && <p className="msg-info">{result.message}</p>}
            <table className="results-table" style={{ fontSize: '1.2rem' }}>
                <thead>
                    <tr>
                        <th style={{ width: '10%' }}>#</th>
                        <th style={{ width: '45%' }}>Open</th>
                        <th style={{ width: '45%' }}>Close</th>
                    </tr>
                </thead>
                <tbody>
                    {result.windows.map((w) => {
                        const openHighlight = !isSameDate(targetDateStr, w.open);
                        const closeHighlight = !isSameDate(targetDateStr, w.close);
                        return (
                            <tr key={w.window_id}>
                                <td>{w.window_id}</td>
                                <td style={openHighlight ? { color: '#d97706', fontWeight: 'bold' } : {}}>
                                    {formatDate(w.open)}
                                </td>
                                <td style={closeHighlight ? { color: '#d97706', fontWeight: 'bold' } : {}}>
                                    {formatDate(w.close)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {result.tides && result.tides.length > 0 && (
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem' }}>
                    <h5 style={{ margin: '0 0 0.25rem 0', color: '#64748b', fontSize: '0.75rem' }}>Reference Tides</h5>
                    <table className="results-table" style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '0.2rem' }}>Time</th>
                                <th style={{ padding: '0.2rem' }}>Height (m)</th>
                                <th style={{ padding: '0.2rem' }}>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.tides.map((t, idx) => (
                                <tr key={idx}>
                                    <td style={{ padding: '0.15rem' }}>{t.time}</td>
                                    <td style={{ padding: '0.15rem' }}>{t.height}</td>
                                    <td style={{ padding: '0.15rem' }}>{t.type}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function isSameDate(targetDateStr, isoStr) {
    if (!isoStr || !targetDateStr) return true;
    return isoStr.startsWith(targetDateStr);
}

function formatDate(isoString) {
    if (!isoString) return "-";
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins} - ${day}/${month}/${String(year).slice(-2)}`;
}

export default WindowCalculator;
