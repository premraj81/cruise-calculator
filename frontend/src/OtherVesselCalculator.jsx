import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UKCColumn } from './components/UKCColumn';
import TideDetails from './components/TideDetails';

function OtherVesselCalculator() {
    const [selectedPort, setSelectedPort] = useState('chalmers');
    const [selectedBerth, setSelectedBerth] = useState(null);

    // Inputs
    const [movement, setMovement] = useState('arrival');
    const [shipName, setShipName] = useState('');
    const [arrivalDate, setArrivalDate] = useState('');
    const [arrivalTime, setArrivalTime] = useState('');
    const [vesselType, setVesselType] = useState('container');
    const [loa, setLoa] = useState('');
    const [breadth, setBreadth] = useState('');
    const [draft, setDraft] = useState('');
    const [bowThruster, setBowThruster] = useState(true);
    const [tugArihi, setTugArihi] = useState(false);

    // Depths & Tide
    const [depthChannel, setDepthChannel] = useState('14.5');
    const [depthBasin, setDepthBasin] = useState('13.5');
    const [depthBerth, setDepthBerth] = useState('13.5');
    const [tideHeight, setTideHeight] = useState(''); // HOT

    const tide = Number(tideHeight) || 0;
    const shipDraft = Number(draft) || 0;

    // --- Dynamic Rules Config ---
    const [configRules, setConfigRules] = useState(null);

    useEffect(() => {
        fetch('/vessel_rules.json')
            .then(res => res.json())
            .then(data => {
                console.log("Rules Config Loaded:", data);
                setConfigRules(data);
            })
            .catch(err => console.error("Failed to load vessel_rules.json:", err));
    }, []);

    // UKC Calculation Logic
    const calculateUKC = (depthVal, type) => {
        const d = Number(depthVal) || 0;
        const total = d + tide;
        let safety = 0;
        let safetyLabel = "(-) Safety";

        if (selectedPort === 'chalmers') {
            // Chalmers Logic
            if (type === 'berth') {
                if (selectedBerth === 'ct' || selectedBerth === 'mp') { safety = 0.4; safetyLabel = "(-) UKC (0.4m Fixed)"; }
                else if (selectedBerth === 'beach') { safety = 0.3; safetyLabel = "(-) UKC (0.3m Fixed)"; }
                else { safety = Math.max(shipDraft * 0.10, 0.8); safetyLabel = "(-) UKC (10% / 0.8m)"; }
            } else {
                // Channel/Basin - Log Ships use 10%
                safety = Math.max(shipDraft * 0.10, 0.8);
                safetyLabel = "(-) UKC (10% / 0.8m)";

                // Fishing/LPG Override
                if ((vesselType === 'fishing' || vesselType === 'lpg') && Number(loa) < 110) {
                    safety = 1.0; safetyLabel = "(-) UKC (1.0m Fixed)";
                }
                // Tanker Override (Chalmers)
                if (vesselType === 'tanker') {
                    safety = 1.25; safetyLabel = "(-) UKC (1.25m Fixed)";
                }
            }
        } else if (selectedPort === 'dunedin') {
            // Dunedin Logic
            if (vesselType === 'tanker' && selectedBerth === 'oil_jetty') {
                if (type === 'channel') safety = 1.25;
                else if (type === 'basin') safety = 0.9;
                else safety = 0.3;
            } else if (vesselType === 'log') {
                // Log Logic
                if (type === 'channel') {
                    safety = (Number(loa) < 150) ? 1.0 : 1.25;
                } else if (type === 'basin') safety = 0.6;
                else safety = 0.3;
            } else if (vesselType === 'fishing') {
                if (type === 'channel') safety = 1.0;
                else if (type === 'basin') safety = 0.6;
                else safety = 0.3;
            } else if (vesselType === 'lpg') {
                if (type === 'channel') safety = 1.25;
                else if (type === 'basin') safety = 0.9;
                else safety = 0.3;
            } else {
                // Default Dunedin
                if (type === 'channel') safety = 1.0;
                else if (type === 'basin') safety = 0.6;
                else safety = 0.3;
            }
            if (type === 'berth') safetyLabel = "(-) Safety (0.3m)";
            else safetyLabel = `(-) UKC (${safety}m)`;
        }

        const ukc = total - shipDraft - safety;
        return { totalDepth: total, ukc, safetyMargin: safety, safetyLabel };
    };

    const ukcChannel = calculateUKC(depthChannel, 'channel');
    const ukcBasin = calculateUKC(depthBasin, 'basin');
    const ukcBerth = calculateUKC(depthBerth, 'berth');

    const handlePortSelect = (port) => {
        setSelectedPort(port);
        setSelectedBerth(null);
        if (port === 'chalmers') {
            setDepthChannel('14.5');
            setDepthBasin('13.5');
            setDepthBerth('13.5');
            setVesselType('container');
        } else {
            setDepthChannel('8.5');
            setDepthBasin('7.3'); // Default
            setDepthBerth('7.5');
            setVesselType('tanker');
        }
    };

    const handleBerthSelect = (berth) => {
        setSelectedBerth(berth);
        if (selectedPort === 'chalmers') {
            if (berth === 'beach') { setDepthBerth('5.5'); }
            else { setDepthBerth('13.5'); } // CT/MP
        } else if (selectedPort === 'dunedin') {
            switch (berth) {
                case 'xy': setDepthBerth('7.7'); break;
                case 'leith': setDepthBerth('8.4'); break;
                case 'lpg': setDepthBerth('6.5'); break;
                case 'ravy': setDepthBerth('8.2'); break;
                case 'oil_jetty': setDepthBerth('8.8'); break;
                case 'tu': setDepthBerth('8.0'); break;
                case 'cm': setDepthBerth('6.0'); break;
                default: setDepthBerth('7.5');
            }
            // Basin overrides
            if (berth === 'tu' || berth === 'cm') setDepthBasin('6.0');
            else setDepthBasin('7.3');
        }
    };

    // --- Vessel Rules Logic (Config Driven) ---
    const getVesselRules = () => {
        if (!loa || !selectedBerth) return null;
        if (!configRules) return null;

        const l = Number(loa) || 0;
        const b = Number(breadth) || 0;
        const d = Number(draft) || 0;

        const portKey = selectedPort === 'chalmers' ? 'chalmers' : 'dunedin';
        const portConfig = configRules.ports[portKey];
        if (!portConfig) return null;

        // 1. Initial Defaults
        let rules = {
            tugs: portConfig.default.tugs,
            ukcRequirement: portConfig.default.ukc,
            wind: portConfig.default.wind,
            tide: portConfig.default.tide,
            remarks: []
        };

        // 2. Type Specific Config
        const typeConfig = portConfig.types[vesselType];
        if (typeConfig) {
            // Base Overrides
            if (typeConfig.wind) rules.wind = typeConfig.wind;
            if (typeConfig.ukc) rules.ukcRequirement = typeConfig.ukc;
            if (typeConfig.tugs) rules.tugs = typeConfig.tugs;
            if (typeConfig.remarks) rules.remarks = [...rules.remarks, ...typeConfig.remarks];

            // Conditional Rules
            if (typeConfig.rules && Array.isArray(typeConfig.rules)) {
                for (const r of typeConfig.rules) {
                    let match = true;
                    if (r.max_loa && l > r.max_loa) match = false;
                    if (r.min_loa && l < r.min_loa) match = false;
                    if (r.min_beam && b < r.min_beam) match = false;
                    if (r.berth && r.berth !== selectedBerth) match = false;
                    if (r.bt !== undefined && r.bt !== bowThruster) match = false;

                    if (match) {
                        if (r.wind) rules.wind = r.wind;
                        if (r.ukc) rules.ukcRequirement = r.ukc;
                        if (r.tugs) rules.tugs = r.tugs;
                        if (r.tide) rules.tide = r.tide;
                        if (r.remarks) rules.remarks = [...rules.remarks, ...r.remarks];
                    }
                }
            }

            // Fishing Tugs Logic (Large/Small)
            if (typeConfig.tugs_large && l >= (typeConfig.loa_max || 104)) {
                rules.tugs = typeConfig.tugs_large;
            }

            // Restrictions
            if (typeConfig.restrictions) {
                if (typeConfig.restrictions.berth === selectedBerth && typeConfig.restrictions.allowed === false) {
                    return {
                        tugs: "RESTRICTED", wind: "N/A", tide: "N/A", ukcRequirement: "N/A",
                        remarks: [typeConfig.restrictions.message]
                    };
                }
            }
        }

        // --- SPECIAL HARDCODED LOGIC ---
        // 1. Rio / Wide Beam Tide Logic
        if (selectedPort === 'chalmers' && (vesselType === 'rio' || (vesselType === 'container' && b > 36))) {
            let tideMsg = "Flood or Ebb * (Dependent on Spring/Neap)";
            const dayEvent = tideData.find(dt => dt.date && dt.date.startsWith(arrivalDate));
            const isSpring = dayEvent && dayEvent.avgHeight >= 1.8;

            if (movement === 'arrival') {
                if (d >= 12) {
                    tideMsg = "Ebb Tide Arrival Only (Draft >= 12m)";
                    rules.remarks.push("Restricted: Draft >= 12m requires Ebb Tide Arrival.");
                } else if (d >= 11 && isSpring) {
                    tideMsg = "Ebb Tide Arrival Only (Draft >= 11m @ Spring)";
                    rules.remarks.push("Restricted: Draft >= 11m on Spring Tide requires Ebb Tide Arrival.");
                }
                if (tideMsg.includes("Ebb Tide Arrival Only")) {
                    rules.remarks.push("Window: Open HW -30min to LW -1h (or until UKC runs out).");
                }
            }
            rules.tide = tideMsg;
        }

        // 2. Max Dimensions Warning (Dunedin)
        if (selectedPort === 'dunedin') {
            const isOversize = ['ravy', 'leith', 'tu'].includes(selectedBerth) && (l > 185 || b > 32.2);
            if (isOversize) {
                rules.remarks.unshift("WARNING: Max Dimensions Exceeded (LOA 185m, Beam 32.2m).");
            }
        }

        // 3. Arihi Check
        if (selectedPort === 'chalmers' && tugArihi) {
            rules.tide = "Ebb Tide Only (Arrive/Depart)";
            rules.remarks.push("Tug Arihi assigned: Ebb Tide Only.");
        }

        return rules;
    };

    const [tideData, setTideData] = useState([]);
    const rules = getVesselRules();

    // Fetch Tide Data
    useEffect(() => {
        const filename = selectedPort === 'dunedin' ? '/tides_dn.json' : '/tides_pc.json';
        fetch(filename)
            .then(res => res.json())
            .then(data => setTideData(data))
            .catch(err => console.error("Failed to load tide data", err));
    }, [selectedPort]);

    // Auto-calculate Tide Height (Interpolation)
    useEffect(() => {
        if (!arrivalDate || !arrivalTime || tideData.length === 0) return;

        if (new Date(arrivalDate) > new Date('2028-12-31')) {
            setTideHeight("N/A (Ends 2028)");
            return;
        }

        const inputDateTime = new Date(`${arrivalDate}T${arrivalTime}`);
        const inputTime = inputDateTime.getTime();

        let t1 = null, t2 = null;
        for (let i = 0; i < tideData.length - 1; i++) {
            if (tideData[i].timestamp <= inputTime && tideData[i + 1].timestamp >= inputTime) {
                t1 = tideData[i]; t2 = tideData[i + 1]; break;
            }
        }

        if (t1 && t2) {
            const timeDiffTotal = t2.timestamp - t1.timestamp;
            const timeDiffCurrent = inputTime - t1.timestamp;
            const theta = Math.PI * (timeDiffCurrent / timeDiffTotal);
            const interpolatedHeight = t1.height + (t2.height - t1.height) * (1 - Math.cos(theta)) / 2;
            setTideHeight(interpolatedHeight.toFixed(2));
        }
    }, [arrivalDate, arrivalTime, tideData]);

    const handleGeneratePDF = () => {
        try {
            const doc = new jsPDF();

            // Header
            doc.setFontSize(18);
            doc.setTextColor(30, 58, 138);
            doc.text("Port Otago - Marine Operations Report", 14, 20);

            doc.setFontSize(14);
            doc.setTextColor(180, 83, 9); // Amber/Bronze
            doc.text("Environmental Parameters & UKC", 14, 28);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);

            // Vessel Details
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text("Vessel & Port Details", 14, 45);

            autoTable(doc, {
                startY: 48,
                head: [['Parameter', 'Value', 'Parameter', 'Value']],
                body: [
                    ['Vessel Name', shipName || 'N/A', 'Port', selectedPort === 'chalmers' ? 'Port Chalmers' : 'Dunedin'],
                    ['Type', vesselType.toUpperCase(), 'Berth', selectedBerth ? selectedBerth.toUpperCase() : 'N/A'],
                    ['Movement', movement.toUpperCase(), 'Side', 'N/A'], // Side not tracked here?
                    ['LOA', `${loa} m`, 'Draft', `${draft} m`],
                    ['Breadth', `${breadth} m`, 'Tugs', rules ? rules.tugs : 'N/A']
                ],
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 138] },
                columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } }
            });

            // Rules
            let finalY = doc.lastAutoTable.finalY + 15;
            doc.text("Port Requirements & Environmental Limits", 14, finalY);

            if (rules) {
                const rulesData = [
                    ['Wind Limit', rules.wind || 'N/A'],
                    ['Tide Requirement', rules.tide || 'N/A'],
                    ['Min UKC Requirement', rules.ukcRequirement || 'N/A']
                ];
                if (rules.remarks && rules.remarks.length > 0) {
                    rulesData.push(['Remarks', rules.remarks.join('; ')]);
                }

                autoTable(doc, {
                    startY: finalY + 3,
                    head: [['Rule', 'Requirement']],
                    body: rulesData,
                    theme: 'striped',
                    headStyles: { fillColor: [180, 83, 9] }
                });
            } else {
                doc.setFontSize(11);
                doc.setTextColor(100);
                doc.text("Rules not loaded or applicable.", 14, finalY + 5);
            }

            // UKC Calculation
            finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : finalY + 20;
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text("Under Keel Clearance (UKC) Calculation", 14, finalY);

            // Calculation Data
            // Columns: Area, Chart Depth, Tide, Total, Draft, Safety, Net UKC
            const ukcRows = [
                ['Channel', depthChannel, tideHeight, ukcChannel.totalDepth.toFixed(2), draft, ukcChannel.safetyLabel, ukcChannel.ukc.toFixed(2)],
                ['Basin', depthBasin, tideHeight, ukcBasin.totalDepth.toFixed(2), draft, ukcBasin.safetyLabel, ukcBasin.ukc.toFixed(2)],
                ['Berth', depthBerth, tideHeight, ukcBerth.totalDepth.toFixed(2), draft, ukcBerth.safetyLabel, ukcBerth.ukc.toFixed(2)]
            ];

            autoTable(doc, {
                startY: finalY + 3,
                head: [['Area', 'Chart Depth', 'Tide', 'Total', 'Draft', 'Safety', 'Net UKC']],
                body: ukcRows,
                theme: 'grid',
                headStyles: { fillColor: [15, 118, 110] }, // Teal
                columnStyles: { 6: { fontStyle: 'bold', textColor: [0, 0, 0] } } // Net UKC bold
            });

            // Highlight Breaches? 
            // We could check if UKC < 0 and color red, but autoTable logic for cell color is complex in simple array. 
            // Simple approach: Add warning text below.

            if (ukcChannel.ukc < 0 || ukcBasin.ukc < 0 || ukcBerth.ukc < 0) {
                doc.setTextColor(220, 38, 38);
                doc.setFontSize(12);
                doc.text("WARNING: Negative UKC Detected!", 14, doc.lastAutoTable.finalY + 10);
            }

            doc.save("environmental_ukc_report.pdf");
        } catch (e) {
            console.error("PDF Fail", e);
            alert("Failed to generate PDF");
        }
    };

    return (
        <div style={{ padding: '0.5rem', fontFamily: 'Inter, sans-serif', maxWidth: '98vw', margin: '0 auto' }}>
            <h2 style={{ color: '#1e3a8a', marginTop: 0, marginBottom: '1rem', textAlign: 'center', fontSize: '1.5rem' }}>Environmental Parameters and UKC Calculation</h2>

            {/* Port Selection */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <PortButton label="Port Chalmers" active={selectedPort === 'chalmers'} onClick={() => handlePortSelect('chalmers')} />
                <PortButton label="Dunedin" active={selectedPort === 'dunedin'} onClick={() => handlePortSelect('dunedin')} />
            </div>

            {/* Berth Selection */}
            {selectedPort === 'chalmers' && (
                <div style={berthContainerStyle}>
                    <h4 style={berthTitleStyle}>Select Berth</h4>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                        <BerthButton label="CT Berth" active={selectedBerth === 'ct'} onClick={() => handleBerthSelect('ct')} />
                        <BerthButton label="MP Berth" active={selectedBerth === 'mp'} onClick={() => handleBerthSelect('mp')} />
                        <BerthButton label="Beach Berth" active={selectedBerth === 'beach'} onClick={() => handleBerthSelect('beach')} />
                    </div>
                </div>
            )}
            {selectedPort === 'dunedin' && (
                <div style={berthContainerStyle}>
                    <h4 style={berthTitleStyle}>Select Dunedin Berth</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem' }}>
                        {['ravy', 'leith', 'oil_jetty', 'xy', 'tu', 'cm', 'lpg'].map(b => (
                            <BerthButton key={b} label={b.toUpperCase().replace('_', ' ')} active={selectedBerth === b} onClick={() => handleBerthSelect(b)} />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Area */}
            {selectedBerth && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1rem', alignItems: 'start' }}>
                    {/* LEFT: Inputs */}
                    <div className="card" style={{ padding: '0.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Vessel Details</h3>

                        {/* Movement */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <MovementBtn label="Arrival" type="arrival" current={movement} onClick={setMovement} />
                            <MovementBtn label="Departure" type="departure" current={movement} onClick={setMovement} />
                        </div>

                        <div style={{ marginBottom: '0.5rem' }}>
                            <label style={labelStyle}>Ship Name</label>
                            <input type="text" value={shipName} onChange={(e) => setShipName(e.target.value)} style={inputStyle} placeholder="Name..." />
                        </div>

                        <div style={{ marginBottom: '0.5rem' }}>
                            <label style={labelStyle}>Vessel Type</label>
                            <select value={vesselType} onChange={(e) => setVesselType(e.target.value)} style={inputStyle}>
                                {selectedPort === 'dunedin' ? (
                                    <>
                                        <option value="tanker">Tanker</option>
                                        <option value="log">Log/Bulk</option>
                                        <option value="cruise">Cruise</option>
                                        <option value="fishing">Fishing</option>
                                        <option value="cement">Cement</option>
                                        <option value="lpg">LPG</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="container">Container</option>
                                        <option value="rio">Rio Vessel</option>
                                        <option value="log">Log Ship</option>
                                        <option value="tanker">Tanker</option>
                                        <option value="fishing">Fishing Boat</option>
                                        <option value="lpg">LPG</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div><label style={labelStyle}>LOA (m)</label><input type="number" value={loa} onChange={(e) => setLoa(e.target.value)} style={inputStyle} placeholder="294" /></div>
                            <div><label style={labelStyle}>Breadth (m)</label><input type="number" value={breadth} onChange={(e) => setBreadth(e.target.value)} style={inputStyle} placeholder="32" /></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div><label style={labelStyle}>Draft (m)</label><input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} style={inputStyle} placeholder="8.5" /></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', justifyContent: 'end' }}>
                                <label style={checkboxStyle}><input type="checkbox" checked={bowThruster} onChange={(e) => setBowThruster(e.target.checked)} /> Bow Thruster</label>
                                <label style={checkboxStyle}><input type="checkbox" checked={tugArihi} onChange={(e) => setTugArihi(e.target.checked)} /> Tug Arihi</label>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div><label style={labelStyle}>Date</label><input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} style={inputStyle} /></div>
                            <div><label style={labelStyle}>Time</label><input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} style={inputStyle} /></div>
                        </div>
                    </div>

                    {/* RIGHT: Rules & Results */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {rules ? (
                            <div className="card" style={{ padding: '0.75rem', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fcd34d', fontSize: '0.85rem' }}>
                                <h3 style={{ marginTop: 0, color: '#b45309', borderBottom: '1px solid #fcd34d', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Port Requirements</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    <RuleRow label="Tugs" value={rules.tugs} color="#1e3a8a" />
                                    {rules.ukcRequirement && <RuleRow label="Min UKC" value={rules.ukcRequirement} color="#be185d" />}
                                    {rules.wind && <RuleRow label="Wind" value={rules.wind} color="#be185d" />}
                                    {rules.tide && <RuleRow label="Tide" value={rules.tide} color="#0f766e" />}
                                    {rules.remarks && rules.remarks.length > 0 && (
                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff1f2', borderRadius: '4px', color: '#dc2626', border: '1px solid #fecdd3' }}>
                                            {rules.remarks.map((r, i) => <div key={i}>• {r}</div>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>Loading Rules...</div>
                        )}

                        <div className="card" style={{ padding: '0.5rem', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                            <h3 style={{ marginTop: 0, color: '#0369a1', borderBottom: '1px solid #bae6fd', paddingBottom: '0.25rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>UKC Calculation</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                                <UKCColumn title="Channel" inputDepth={depthChannel} setInputDepth={setDepthChannel} tideHeight={tideHeight} setTideHeight={setTideHeight} calculation={ukcChannel} shipDraft={shipDraft} compact={true} />
                                <UKCColumn title="Basin" inputDepth={depthBasin} setInputDepth={setDepthBasin} tideHeight={tideHeight} setTideHeight={setTideHeight} calculation={ukcBasin} shipDraft={shipDraft} compact={true} />
                                <UKCColumn title="Berth" inputDepth={depthBerth} setInputDepth={setDepthBerth} tideHeight={tideHeight} setTideHeight={setTideHeight} calculation={ukcBerth} shipDraft={shipDraft} compact={true} />
                            </div>
                        </div>

                        <button onClick={handleGeneratePDF} style={{ padding: '0.75rem', background: '#d97706', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            📄 Generate PDF Report
                        </button>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                        <TideDetails tideData={tideData} date={arrivalDate} time={arrivalTime} />
                    </div>
                </div>
            )}
        </div>
    );
}

// Helpers

function PortButton({ label, active, onClick }) {
    const activeStyle = {
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        color: '#fcd34d', // Amber 300
        border: '2px solid #d97706', // Amber 600
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
    };
    const inactiveStyle = {
        background: 'white',
        color: '#475569',
        border: '1px solid #cbd5e1',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    };

    return (
        <button
            onClick={onClick}
            style={{
                padding: '0.6rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                ...(active ? activeStyle : inactiveStyle)
            }}
        >
            {label}
        </button>
    );
}

function BerthButton({ label, active, onClick }) {
    const activeStyle = {
        background: '#1e3a8a',
        color: '#fbbf24', // Amber 400
        border: '1px solid #f59e0b', // Amber 500
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    };
    const inactiveStyle = {
        background: 'white',
        color: '#64748b',
        border: '1px solid #e2e8f0'
    };

    return (
        <button
            onClick={onClick}
            style={{
                padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: '80px',
                ...(active ? activeStyle : inactiveStyle)
            }}
        >
            {label}
        </button>
    );
}

function MovementBtn({ label, type, current, onClick }) {
    const active = current === type;
    const color = type === 'arrival' ? '#15803d' : '#b91c1c';
    const bg = type === 'arrival' ? '#dcfce7' : '#fee2e2';
    return <button onClick={() => onClick(type)} style={{ flex: 1, padding: '0.25rem', borderRadius: '4px', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer', border: active ? `1px solid ${color}` : '1px solid #e2e8f0', background: active ? bg : 'white', color: active ? color : '#64748b' }}>{label}</button>;
}
function RuleRow({ label, value, color }) {
    return <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: '600', color: '#78350f' }}>{label}:</span><span style={{ fontWeight: '700', color: color, textAlign: 'right' }}>{value}</span></div>;
}

const labelStyle = { display: 'block', marginBottom: '0.15rem', color: '#475569', fontWeight: '600', fontSize: '0.75rem' };
const inputStyle = { width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '500' };
const checkboxStyle = { display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: '#475569', cursor: 'pointer' };
const berthContainerStyle = { background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #e2e8f0', textAlign: 'center' };
const berthTitleStyle = { margin: '0 0 1rem 0', color: '#64748b' };

export default OtherVesselCalculator;
