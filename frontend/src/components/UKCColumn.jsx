function UKCColumn({ title, inputDepth, setInputDepth, tideHeight, setTideHeight, calculation, shipDraft, isTideReadOnly }) {
    const { totalDepth, safetyMargin, ukc, safetyLabel } = calculation;

    // Condensed styles
    const inputStyle = { width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '500', textAlign: 'right' };
    const labelStyle = { display: 'block', marginBottom: '0.15rem', color: '#64748b', fontWeight: '500', fontSize: '0.75rem' };
    const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' };

    return (
        <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#334155', textAlign: 'center', fontSize: '0.9rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>{title}</h4>

            {/* Depth Input */}
            <div style={{ marginBottom: '0.5rem' }}>
                <label style={labelStyle}>Depth Available (m)</label>
                <input
                    type="number"
                    value={inputDepth}
                    onChange={(e) => setInputDepth(e.target.value)}
                    style={inputStyle}
                    placeholder="0.0"
                />
            </div>

            {/* Tide Input/Display */}
            <div style={{ marginBottom: '0.5rem' }}>
                <label style={labelStyle}>(+) Tide (m)</label>
                <input
                    type="number"
                    value={tideHeight}
                    onChange={(e) => !isTideReadOnly && setTideHeight(e.target.value)}
                    readOnly={isTideReadOnly}
                    style={{
                        ...inputStyle,
                        background: isTideReadOnly ? '#f1f5f9' : 'white',
                        borderColor: isTideReadOnly ? '#e2e8f0' : '#3b82f6'
                    }}
                    placeholder="0.0"
                />
            </div>

            <div style={{ height: '1px', background: '#cbd5e1', margin: '0.4rem 0' }}></div>

            {/* Calculations Display */}
            <div style={rowStyle}>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>Total Depth</span>
                <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.8rem' }}>{totalDepth.toFixed(2)}</span>
            </div>

            <div style={rowStyle}>
                <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>(-) Draft</span>
                <span style={{ fontWeight: '500', color: '#ef4444', fontSize: '0.8rem' }}>{shipDraft.toFixed(2)}</span>
            </div>

            <div style={rowStyle}>
                <span style={{ fontSize: '0.75rem', color: '#d97706' }}>{safetyLabel || "(-) Safety"}</span>
                <span style={{ fontWeight: '500', color: '#d97706', fontSize: '0.8rem' }}>{safetyMargin.toFixed(2)}</span>
            </div>

            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.1rem' }}>Reserve UKC</div>
                <div style={{
                    fontSize: '1.2rem',
                    fontWeight: '800',
                    color: ukc < 0 ? '#dc2626' : '#16a34a'
                }}>
                    {ukc.toFixed(2)} m
                </div>
            </div>
        </div>
    );
}

export { UKCColumn };
