import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Constants for Geometry
const BASIN_POINTS = [
    { name: 'A', dist: 0, bearing: 0 },
    { name: 'B', dist: 385, bearing: 73 },
    { name: 'C', dist: 273, bearing: 311.3 },
    { name: 'D', dist: 287, bearing: 222.5 },
];

const getCoordinates = () => {
    let x = 0;
    let y = 0;
    const coords = [{ name: 'A', x, y }];

    // A -> B
    const radB = (90 - 73) * (Math.PI / 180);
    x += 385 * Math.cos(radB);
    y += 385 * Math.sin(radB);
    coords.push({ name: 'B', x, y });

    // B -> C
    const radC = (90 - 311.3) * (Math.PI / 180);
    x += 273 * Math.cos(radC);
    y += 273 * Math.sin(radC);
    coords.push({ name: 'C', x, y });

    // C -> D
    const radD = (90 - 222.5) * (Math.PI / 180);
    x += 287 * Math.cos(radD);
    y += 287 * Math.sin(radD);
    coords.push({ name: 'D', x, y });

    return coords;
};

const BASIN_COORDS = getCoordinates();

function BerthCalculator() {
    // Config
    const [ctShip, setCtShip] = useState({
        name: 'Ovation of the Seas',
        length: 254,
        beam: 32.2,
        sternPos: 280,
        sideToWharf: 'port',
        color: '#ef4444'
    });

    const [beachShip, setBeachShip] = useState({
        active: true,
        name: 'Beach Ship',
        length: 200,
        beam: 30,
        sternPos: 50,
        sideToWharf: 'port',
        color: '#f59e0b'
    });

    const [metrics, setMetrics] = useState({
        ctPoly: null,
        beachPoly: null,
        closestDistToBeach: null,
        distBetweenShips: null,
        closestPts: null
    });

    const [enlarged, setEnlarged] = useState(false);
    const canvasRef = useRef(null);
    const modalCanvasRef = useRef(null);

    // Helpers
    const getClosestPtOnSegment = (p, v, w) => {
        const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
        if (l2 === 0) return v;
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    };

    const getClosestPointsPolyPoly = (poly1, poly2) => {
        let minD = Infinity;
        let res = null;
        for (let p1 of poly1) {
            for (let i = 0; i < poly2.length; i++) {
                const p2a = poly2[i];
                const p2b = poly2[(i + 1) % poly2.length];
                const proj = getClosestPtOnSegment(p1, p2a, p2b);
                const d = Math.hypot(p1.x - proj.x, p1.y - proj.y);
                if (d < minD) { minD = d; res = { p1: p1, p2: proj }; }
            }
        }
        for (let p2 of poly2) {
            for (let i = 0; i < poly1.length; i++) {
                const p1a = poly1[i];
                const p1b = poly1[(i + 1) % poly1.length];
                const proj = getClosestPtOnSegment(p2, p1a, p1b);
                const d = Math.hypot(p2.x - proj.x, p2.y - proj.y);
                if (d < minD) { minD = d; res = { p1: proj, p2: p2 }; }
            }
        }
        return { dist: minD, ...res };
    };

    // Recalculate Logic
    useEffect(() => {
        const C = BASIN_COORDS[2];
        const D = BASIN_COORDS[3];
        const vecCD = { x: D.x - C.x, y: D.y - C.y };
        const lenCD = Math.hypot(vecCD.x, vecCD.y);
        const uCD = { x: vecCD.x / lenCD, y: vecCD.y / lenCD };
        const normCD = { x: -uCD.y, y: uCD.x };

        const ctFacingD = ctShip.sideToWharf === 'starboard';
        let ctStart = ctShip.sternPos;
        let ctEnd = ctFacingD ? ctStart + ctShip.length : ctStart - ctShip.length;
        const ctP_Stern = { x: C.x + uCD.x * ctStart, y: C.y + uCD.y * ctStart };
        const ctP_Bow = { x: C.x + uCD.x * ctEnd, y: C.y + uCD.y * ctEnd };
        const ctOffset = { x: normCD.x * ctShip.beam, y: normCD.y * ctShip.beam };
        const ctPoly = [ctP_Stern, { x: ctP_Stern.x + ctOffset.x, y: ctP_Stern.y + ctOffset.y }, { x: ctP_Bow.x + ctOffset.x, y: ctP_Bow.y + ctOffset.y }, ctP_Bow];

        // Improve Poly (Optional: Add bow tip)
        const ctBowMid = { x: (ctPoly[3].x + ctPoly[2].x) / 2, y: (ctPoly[3].y + ctPoly[2].y) / 2 };
        const ctShipVec = { x: ctP_Bow.x - ctP_Stern.x, y: ctP_Bow.y - ctP_Stern.y };
        const ctLen = Math.hypot(ctShipVec.x, ctShipVec.y);
        const ctUnit = { x: ctShipVec.x / ctLen, y: ctShipVec.y / ctLen };
        const ctTip = { x: ctBowMid.x + ctUnit.x * 20, y: ctBowMid.y + ctUnit.y * 20 };
        ctPoly.splice(3, 0, ctTip); // Insert tip


        const A = BASIN_COORDS[0];
        const B = BASIN_COORDS[1];
        const vecAB = { x: B.x - A.x, y: B.y - A.y };
        const lenAB = Math.hypot(vecAB.x, vecAB.y);
        const uAB = { x: vecAB.x / lenAB, y: vecAB.y / lenAB };
        const normAB = { x: -uAB.y, y: uAB.x };

        let beachPoly = null;
        if (beachShip.active) {
            const bSternFromA = 385 - beachShip.sternPos;
            const beachFacingB = beachShip.sideToWharf === 'starboard';
            let bStart = bSternFromA;
            let bEnd = beachFacingB ? bStart + beachShip.length : bStart - beachShip.length;
            const bP_Stern = { x: A.x + uAB.x * bStart, y: A.y + uAB.y * bStart };
            const bP_Bow = { x: A.x + uAB.x * bEnd, y: A.y + uAB.y * bEnd };
            const bOffset = { x: normAB.x * beachShip.beam, y: normAB.y * beachShip.beam };
            beachPoly = [bP_Stern, { x: bP_Stern.x + bOffset.x, y: bP_Stern.y + bOffset.y }, { x: bP_Bow.x + bOffset.x, y: bP_Bow.y + bOffset.y }, bP_Bow];

            const bBowMid = { x: (beachPoly[3].x + beachPoly[2].x) / 2, y: (beachPoly[3].y + beachPoly[2].y) / 2 };
            const bShipVec = { x: bP_Bow.x - bP_Stern.x, y: bP_Bow.y - bP_Stern.y };
            const bLen = Math.hypot(bShipVec.x, bShipVec.y);
            const bUnit = { x: bShipVec.x / bLen, y: bShipVec.y / bLen };
            const bTip = { x: bBowMid.x + bUnit.x * 20, y: bBowMid.y + bUnit.y * 20 };
            beachPoly.splice(3, 0, bTip);
        }

        let minD = Infinity;
        ctPoly.forEach(p => {
            const AP = { x: p.x - A.x, y: p.y - A.y };
            const d = AP.x * normAB.x + AP.y * normAB.y;
            if (d < minD) minD = d;
        });

        let shipsDist = null;
        let closestPts = null;
        if (beachPoly) {
            const res = getClosestPointsPolyPoly(ctPoly, beachPoly);
            shipsDist = res.dist;
            closestPts = { p1: res.p1, p2: res.p2 };
        }

        setMetrics({ ctPoly, beachPoly, closestDistToBeach: minD, distBetweenShips: shipsDist, closestPts });
    }, [ctShip, beachShip]);

    // Drawing
    const drawCanvas = (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.save();

        const ROTATION = 45 * (Math.PI / 180);
        const cosR = Math.cos(ROTATION);
        const sinR = Math.sin(ROTATION);
        const rotate = (p) => ({ x: p.x * cosR - p.y * sinR, y: p.x * sinR + p.y * cosR });

        const rotatedPoints = BASIN_COORDS.map(p => rotate(p));
        const xs = rotatedPoints.map(p => p.x);
        const ys = rotatedPoints.map(p => p.y);
        const bMinX = Math.min(...xs); const bMaxX = Math.max(...xs);
        const bMinY = Math.min(...ys); const bMaxY = Math.max(...ys);
        const bW = bMaxX - bMinX; const bH = bMaxY - bMinY;

        // Visual Enhancement: Reduce margin to make image bigger, shift right
        const margin = 40; // Reduced from 60
        const scale = Math.min((width - margin * 2) / bW, (height - margin * 2) / bH);

        // Shift Right: Add extra offset to X
        const shiftX = 150;
        const offsetX = margin - bMinX * scale + shiftX;
        const offsetY = height - margin + bMinY * scale;

        const toScreen = (pMath) => {
            const pr = rotate(pMath);
            return { x: offsetX + pr.x * scale, y: offsetY - pr.y * scale };
        };

        // 1. Water
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#bae6fd');
        grad.addColorStop(1, '#7dd3fc');
        ctx.fillStyle = grad;
        ctx.beginPath();
        const p0 = toScreen(BASIN_COORDS[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < BASIN_COORDS.length; i++) ctx.lineTo(toScreen(BASIN_COORDS[i]).x, toScreen(BASIN_COORDS[i]).y);
        ctx.closePath(); ctx.fill();

        // 3. Markings & Decoration
        const drawEnvironment = (startPt, endPt, type) => {
            const vec = { x: endPt.x - startPt.x, y: endPt.y - startPt.y };
            const len = Math.hypot(vec.x, vec.y);
            const u = { x: vec.x / len, y: vec.y / len };
            const perp = { x: -u.y, y: u.x }; // Points "out" to water (usually) - check direction
            // We want "Land" side. For A->B (Beach), water is "right"? Basin is A-B-C-D counter-clockwise?
            // A(0,0) -> B(385 @ 73). B->C. C->D. D->A. This is a loop.
            // Inner logic: A->B, if we walk A->B, basin is to our right?

            // Adjust perp for "Land Side" visual offset based on Wharf Type
            // Beach (B->A): -perp is correct (Land).
            // CT (C->D): needs opposite of Beach to be on Land side.
            const sideFactor = type === 'CT' ? -1 : 1;
            const landDir = { x: -perp.x * sideFactor, y: -perp.y * sideFactor };

            // Distances (Ruler)
            ctx.fillStyle = '#1e293b'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let d = 0; d <= Math.floor(len); d += 20) {
                const pWorld = { x: startPt.x + u.x * d, y: startPt.y + u.y * d };
                const pS = toScreen(pWorld);
                // Ticks along the edge
                const tickLen = (d % 20 === 0) ? 10 : 5; // Major tick every 20m
                const pTickEndS = toScreen({ x: pWorld.x - landDir.x * tickLen, y: pWorld.y - landDir.y * tickLen });
                ctx.beginPath(); ctx.moveTo(pS.x, pS.y); ctx.lineTo(pTickEndS.x, pTickEndS.y);
                ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();

                // Text every 20m
                if (d % 20 === 0) {
                    const pTextS = toScreen({ x: pWorld.x - landDir.x * 20, y: pWorld.y - landDir.y * 20 });
                    ctx.fillText(d.toString(), pTextS.x, pTextS.y);
                }

                // Bollards every 40m (offset slightly)
                if (d % 40 === 20) {
                    const bollardPos = toScreen({ x: pWorld.x - landDir.x * 3, y: pWorld.y - landDir.y * 3 });
                    ctx.beginPath(); ctx.arc(bollardPos.x, bollardPos.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#334155'; ctx.fill();
                }
            }

            // Specific Decorations
            if (type === 'CT') {
                // Containers (Colorful Rects)
                const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#6366f1'];
                for (let i = 20; i < len - 40; i += 35) {
                    if (Math.random() > 0.3) {
                        const cx = startPt.x + u.x * i - landDir.x * 25;
                        const cy = startPt.y + u.y * i - landDir.y * 25;
                        // Draw a simple rect rotated
                        const cW = 20, cH = 10;
                        const pC = toScreen({ x: cx, y: cy });
                        ctx.save();
                        ctx.translate(pC.x, pC.y);
                        // Use known bearing or just align with line
                        const angle = Math.atan2(vec.y, vec.x);
                        ctx.rotate(-angle); // Canvas rotates clockwise?
                        ctx.fillStyle = colors[Math.floor(i % colors.length)];
                        ctx.fillRect(-5, -5, 10, 20); // vertical container relative to wharf
                        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                        ctx.strokeRect(-5, -5, 10, 20);
                        ctx.restore();
                    }
                }
                // Building
                const shedPos = { x: startPt.x + u.x * (len - 60) - landDir.x * 40, y: startPt.y + u.y * (len - 60) - landDir.y * 40 };
                const sS = toScreen(shedPos);
                ctx.fillStyle = '#94a3b8';
                ctx.beginPath(); ctx.rect(sS.x - 15, sS.y - 15, 30, 30); ctx.fill();
                ctx.fillStyle = '#cbd5e1'; ctx.font = '10px Arial'; ctx.fillText("TERM", sS.x, sS.y);
            } else if (type === 'Beach') {
                // Logs (Brown Circles/Rects)
                for (let i = 40; i < len - 40; i += 15) {
                    if (Math.random() > 0.2) {
                        const lx = startPt.x + u.x * i - landDir.x * 25;
                        const ly = startPt.y + u.y * i - landDir.y * 25;
                        const pL = toScreen({ x: lx, y: ly });
                        ctx.fillStyle = '#92400e'; // Brown
                        ctx.beginPath(); ctx.arc(pL.x, pL.y, 3, 0, Math.PI * 2); ctx.fill();
                        // Stack effect
                        ctx.beginPath(); ctx.arc(pL.x + 2, pL.y + 2, 3, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(pL.x - 1, pL.y + 3, 3, 0, Math.PI * 2); ctx.fill();
                    }
                }
                // Warehouse
                const warePos = { x: startPt.x + u.x * 50 - landDir.x * 50, y: startPt.y + u.y * 50 - landDir.y * 50 };
                const wS = toScreen(warePos);
                ctx.fillStyle = '#64748b';
                ctx.beginPath(); ctx.rect(wS.x - 20, wS.y - 10, 40, 20); ctx.fill();
                ctx.fillStyle = 'white'; ctx.fillText("SHED", wS.x, wS.y);
            }
        };

        // 4. Wharves
        ctx.lineWidth = 6; ctx.lineCap = 'round';
        const A = BASIN_COORDS[0]; const B = BASIN_COORDS[1];
        const pA = toScreen(A); const pB = toScreen(B);

        // Draw Beach Street Line (A->B)
        ctx.strokeStyle = '#334155'; ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y); ctx.stroke();
        ctx.fillStyle = '#0f172a'; ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('Beach Street Wharf', (pA.x + pB.x) / 2, (pA.y + pB.y) / 2 + 30); // Offset text
        drawEnvironment(B, A, 'Beach'); // Note: B->A for distance 0 to start at B? No, usually 0 is start of wharf.
        // If user wants A to be 0: drawEnvironment(A, B, 'Beach'); 
        // Existing input says "Stern Pos (from B)". So 0 is at B. Correct to pass B->A.

        const C = BASIN_COORDS[2]; const D = BASIN_COORDS[3];
        const pC = toScreen(C); const pD = toScreen(D);

        // Draw CT Berth Line (C->D)
        ctx.beginPath(); ctx.moveTo(pC.x, pC.y); ctx.lineTo(pD.x, pD.y); ctx.stroke();
        ctx.fillStyle = '#0f172a'; ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillText('CT Berth', (pC.x + pD.x) / 2 - 60, (pC.y + pD.y) / 2 - 25);
        drawEnvironment(C, D, 'CT'); // Stern Pos (from C). So 0 is at C. Correct C->D.

        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(pD.x, pD.y); ctx.lineTo(pA.x, pA.y); ctx.stroke();

        // 6. Ships
        const drawShip = (poly, color, name) => {
            if (!poly || poly.length < 5) return;
            const sP = poly.map(toScreen);

            // Draw Polygon
            ctx.fillStyle = color; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sP[0].x, sP[0].y);
            for (let i = 1; i < sP.length; i++) ctx.lineTo(sP[i].x, sP[i].y);
            ctx.closePath(); ctx.fill(); ctx.stroke();

            // Calculate Center
            let cx = 0, cy = 0;
            sP.forEach(p => { cx += p.x; cy += p.y; });
            cx /= sP.length; cy /= sP.length;

            // Calculate Angle: Bow to Stern
            // Indices: 0,1 are Stern. 2,4 are Bow. (3 is Tip)
            const sternX = (sP[0].x + sP[1].x) / 2;
            const sternY = (sP[0].y + sP[1].y) / 2;
            const bowX = (sP[2].x + sP[4].x) / 2;
            const bowY = (sP[2].y + sP[4].y) / 2;

            // Vector: Bow -> Stern (Text flows from Bow towards Stern)
            const dx = sternX - bowX;
            const dy = sternY - bowY;
            const angle = Math.atan2(dy, dx);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Inter, sans-serif'; // Bigger font
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
            ctx.fillText(name, 0, 0);
            ctx.restore();
        };

        if (metrics.ctPoly) drawShip(metrics.ctPoly, ctShip.color, ctShip.name);
        if (metrics.beachPoly) drawShip(metrics.beachPoly, beachShip.color, beachShip.name);

        if (metrics.closestPts) {
            const sP1 = toScreen(metrics.closestPts.p1);
            const sP2 = toScreen(metrics.closestPts.p2);
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(sP1.x, sP1.y); ctx.lineTo(sP2.x, sP2.y); ctx.stroke();
            ctx.setLineDash([]);
            const mx = (sP1.x + sP2.x) / 2; const my = (sP1.y + sP2.y) / 2;
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = '#ef4444'; ctx.stroke();
            ctx.fillStyle = '#ef4444'; ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`${metrics.distBetweenShips.toFixed(1)}m`, mx, my);
        }

        ctx.restore();
    };

    useEffect(() => {
        const c = canvasRef.current;
        if (c) drawCanvas(c.getContext('2d'), c.width, c.height);

        // Also draw to modal canvas if visible
        if (enlarged && modalCanvasRef.current) {
            const mc = modalCanvasRef.current;
            drawCanvas(mc.getContext('2d'), mc.width, mc.height);
        }
    });

    const ctBowPos = ctShip.sideToWharf === 'starboard' ? ctShip.sternPos + ctShip.length : ctShip.sternPos - ctShip.length;
    const beachBowPos = beachShip.sideToWharf === 'starboard' ? beachShip.sternPos - beachShip.length : beachShip.sternPos + beachShip.length;
    const ctWarn = ctShip.sternPos > 288;
    const ctErr = ctShip.sternPos > 305;
    const beachWarn = beachShip.sternPos > 370;
    const beachErr = beachShip.sternPos > 385;

    const handleGeneratePDF = () => {
        try {
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.setTextColor(30, 58, 138); // Dark Blue
            doc.text("Port Otago - Berth Clearance Report", 14, 20);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

            // CT Berth Data
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("CT Berth - Vessel Details", 14, 40);

            autoTable(doc, {
                startY: 45,
                head: [['Vessel Name', 'LOA (m)', 'Beam (m)', 'Stern Pos', 'Bow Pos', 'Side']],
                body: [[ctShip.name, ctShip.length, ctShip.beam, `${ctShip.sternPos} m`, `${ctBowPos.toFixed(1)} m`, ctShip.sideToWharf]],
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 138] }
            });

            // Beach Wharf Data
            let finalY = doc.lastAutoTable.finalY + 15;
            doc.text("Beach Street Wharf - Vessel Details", 14, finalY);
            if (beachShip.active) {
                autoTable(doc, {
                    startY: finalY + 5,
                    head: [['Vessel Name', 'LOA (m)', 'Beam (m)', 'Stern Pos', 'Bow Pos', 'Side']],
                    body: [[beachShip.name, beachShip.length, beachShip.beam, `${beachShip.sternPos} m`, `${beachBowPos.toFixed(1)} m`, beachShip.sideToWharf]],
                    theme: 'grid',
                    headStyles: { fillColor: [180, 83, 9] } // Amber
                });
            } else {
                doc.setFontSize(11);
                doc.setTextColor(100);
                doc.text("(No Vessel Assigned)", 14, finalY + 10);
                // Adjust finalY to account for the text line
                finalY += 10;
            }

            // Metrics
            // Be careful with finalY from undefined table
            finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : finalY + 15;

            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("Clearance Metrics", 14, finalY);

            const metricsData = [
                ['CT Hull to Beach Wharf', metrics.closestDistToBeach ? `${metrics.closestDistToBeach.toFixed(2)} m` : 'N/A']
            ];
            if (beachShip.active) {
                metricsData.push(['Inter-Ship Clearance', metrics.distBetweenShips ? `${metrics.distBetweenShips.toFixed(2)} m` : 'N/A']);
            }

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Metric', 'Value']],
                body: metricsData,
                theme: 'striped'
            });

            // Warning
            if (ctWarn || ctErr || beachWarn || beachErr) {
                doc.setTextColor(220, 38, 38);
                doc.setFontSize(12);
                doc.text("WARNING: Berth Constraint Limits Exceeded!", 14, doc.lastAutoTable.finalY + 15);
            }

            doc.save("berth_report.pdf");
        } catch (e) {
            console.error("PDF Fail:", e);
            alert(`Failed to generate PDF: ${e.message}`);
        }
    };



    return (
        <div className="berth-calculator" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontFamily: 'Inter, sans-serif', alignItems: 'center' }}>

            {/* TOP ROW: Inputs Left - Canvas Center - Inputs Right */}
            <div className="main-row" style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center', alignItems: 'flex-start' }}>

                {/* LEFT: CT Berth Inputs */}
                <div className="inputs-left" style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: ctErr ? '2px solid #ef4444' : ctWarn ? '2px solid #f59e0b' : '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: '#1e3a8a' }}>CT Berth</h3>
                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: ctShip.color }}></div>
                        </div>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Ship Name</label>
                                <input type="text" value={ctShip.name} onChange={e => setCtShip({ ...ctShip, name: e.target.value })} style={inputStyle} />
                            </div>
                            <div><label style={labelStyle}>LOA (m)</label><input type="number" value={ctShip.length} onChange={e => setCtShip({ ...ctShip, length: Number(e.target.value) })} style={inputStyle} /></div>
                            <div><label style={labelStyle}>Beam (m)</label><input type="number" value={ctShip.beam} onChange={e => setCtShip({ ...ctShip, beam: Number(e.target.value) })} style={inputStyle} /></div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}><span style={{ marginRight: '10px' }}>Side to Wharf:</span>
                                    <SideBtn active={ctShip.sideToWharf === 'port'} onClick={() => setCtShip({ ...ctShip, sideToWharf: 'port' })} label="Port" />
                                    <SideBtn active={ctShip.sideToWharf === 'starboard'} onClick={() => setCtShip({ ...ctShip, sideToWharf: 'starboard' })} label="Stbd" />
                                </label>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Stern Position</label>
                                <input type="number" value={ctShip.sternPos} onChange={e => setCtShip({ ...ctShip, sternPos: Number(e.target.value) })} style={{ ...inputStyle, borderColor: ctErr ? '#ef4444' : ctWarn ? '#f59e0b' : '#cbd5e1' }} />
                                {ctWarn && <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '4px', background: ctErr ? '#fee2e2' : '#fef3c7', color: ctErr ? '#b91c1c' : '#b45309', fontSize: '0.8rem', fontWeight: 'bold' }}>{ctErr ? '❌ MAX REACHED (305m)' : '⚠️ Warning > 288m'}</div>}
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Bow Position</label>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{ctBowPos.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>m</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* VISUALIZATION */}
                <div className="visualization" style={{ flex: '0 1 900px', display: 'flex', justifyContent: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)' }}>
                    <div style={{ position: 'relative' }}>
                        <canvas ref={canvasRef} width={900} height={800} onClick={() => setEnlarged(true)} style={{ maxWidth: '100%', height: 'auto', cursor: 'zoom-in', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} title="Click to Enlarge" />
                        <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(255,255,255,0.8)', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', color: '#64748b', pointerEvents: 'none' }}>Click to Enlarge 🔍</div>
                    </div>
                </div>

                {/* RIGHT: Beach Wharf Inputs (Moved from Left, Checkbox Removed) */}
                <div className="inputs-right" style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: beachErr ? '2px solid #ef4444' : beachWarn ? '2px solid #f59e0b' : '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: '#b45309' }}>Beach Wharf</h3>
                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: beachShip.color }}></div>
                        </div>
                        {/* Always Active */}
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Ship Name</label><input type="text" value={beachShip.name} onChange={e => setBeachShip({ ...beachShip, name: e.target.value })} style={inputStyle} /></div>
                            <div><label style={labelStyle}>LOA (m)</label><input type="number" value={beachShip.length} onChange={e => setBeachShip({ ...beachShip, length: Number(e.target.value) })} style={inputStyle} /></div>
                            <div><label style={labelStyle}>Beam (m)</label><input type="number" value={beachShip.beam} onChange={e => setBeachShip({ ...beachShip, beam: Number(e.target.value) })} style={inputStyle} /></div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}><span style={{ marginRight: '10px' }}>Side to Wharf:</span>
                                    <SideBtn active={beachShip.sideToWharf === 'port'} onClick={() => setBeachShip({ ...beachShip, sideToWharf: 'port' })} label="Port" />
                                    <SideBtn active={beachShip.sideToWharf === 'starboard'} onClick={() => setBeachShip({ ...beachShip, sideToWharf: 'starboard' })} label="Stbd" />
                                </label>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Stern Position</label>
                                <input type="number" value={beachShip.sternPos} onChange={e => setBeachShip({ ...beachShip, sternPos: Number(e.target.value) })} style={{ ...inputStyle, borderColor: beachErr ? '#ef4444' : beachWarn ? '#f59e0b' : '#cbd5e1' }} />
                                {beachWarn && <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '4px', background: beachErr ? '#fee2e2' : '#fef3c7', color: beachErr ? '#b91c1c' : '#b45309', fontSize: '0.8rem', fontWeight: 'bold' }}>{beachErr ? '❌ MAX REACHED (385m)' : '⚠️ Warning > 370m'}</div>}
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Bow Position</label>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{beachBowPos.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>m</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* PDF Button moved here or kept with top inputs? User didn't specify PDF button location, but logical to keep in one of the side bars. Let's put it on the Right below Beach. */}
                    <button onClick={handleGeneratePDF} style={{ padding: '1rem', background: '#1e40af', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(30, 64, 175, 0.4)' }}>
                        📄 Generate Report (PDF)
                    </button>
                </div>
            </div>

            {/* BOTTOM ROW: Metrics (Full Width) */}
            <div className="results" style={{ width: '100%', maxWidth: '1200px', display: 'flex', gap: '2rem', padding: '1.5rem', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', justifyContent: 'space-around', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: 0, color: '#0369a1', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Current Metrics</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Real-time Clearance Calculations</p>
                </div>

                <div style={{ display: 'flex', gap: '4rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CT Hull ↔ Beach Wharf</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '800', color: (metrics.closestDistToBeach && metrics.closestDistToBeach < 50) ? '#ef4444' : '#0284c7', lineHeight: 1 }}>
                            {metrics.closestDistToBeach !== null ? metrics.closestDistToBeach.toFixed(2) : '-'} <span style={{ fontSize: '1.2rem', color: '#64748b' }}>m</span>
                        </div>
                    </div>
                    {metrics.distBetweenShips !== null && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ship ↔ Ship</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: metrics.distBetweenShips < 30 ? '#ef4444' : '#0284c7', lineHeight: 1 }}>
                                {metrics.distBetweenShips.toFixed(2)} <span style={{ fontSize: '1.2rem', color: '#64748b' }}>m</span>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '150px' }}>
                    <p style={{ margin: 0 }}><strong>Note:</strong> Distances are approximate relative to defined berth lines.</p>
                </div>
            </div>

            {/* MODAL */}
            {enlarged && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setEnlarged(false)}>
                    <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', maxWidth: '95vw', maxHeight: '95vh', overflow: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEnlarged(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
                        <canvas ref={modalCanvasRef} width={1200} height={1000} style={{ display: 'block', maxWidth: '100%', maxHeight: '85vh' }} />
                        <div style={{ textAlign: 'center', marginTop: '10px', color: '#64748b' }}>Port Otago Operations Dashboard</div>
                    </div>
                </div>
            )}
        </div>
    );
}

const labelStyle = { display: 'block', fontSize: '0.85rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' };
const inputStyle = { width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '500', fontSize: '0.95rem' };
function SideBtn({ active, onClick, label }) {
    return (
        <button onClick={onClick} style={{
            padding: '0.25rem 0.5rem', borderRadius: '4px', margin: '0 2px',
            border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
            background: active ? '#eff6ff' : '#fff', color: active ? '#1e40af' : '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem'
        }}>
            {label}
        </button>
    );
}

export default BerthCalculator;
