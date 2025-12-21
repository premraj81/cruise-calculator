import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Constants
// Use environment variable for API URL in production, fallback to localhost for dev
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [apiToken, setApiToken] = useState(''); // Store password as API Key
  const [shipType, setShipType] = useState('princess');
  const [movement, setMovement] = useState('arrival');
  const [dates, setDates] = useState(['']);
  const [results, setResults] = useState({});

  // Auto-logout on inactivity (10 minutes)
  useEffect(() => {
    if (!isLoggedIn) return;

    let timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsLoggedIn(false);
        setApiToken('');
        setResults({});
        setDates(['']);
      }, 10 * 60 * 1000); // 10 minutes
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer(); // Start timer

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setApiToken('');
    setResults({});
    setDates(['']);
  };


  if (!isLoggedIn) {
    return <LoginScreen onLogin={(user, pass) => {
      // Basic client-side check + Store token for backend
      if (user.trim() === 'PortOtago' && pass.trim() === 'CRUISE@ship25') {
        setApiToken(pass.trim());
        setIsLoggedIn(true);
      } else {
        alert('Invalid Credentials');
      }
    }} />;
  }

  const handleDateChange = (index, value) => {
    const newDates = [...dates];
    newDates[index] = value;
    setDates(newDates);
    // Clear result for this index when date changes (resets button to White)
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

  const handleToggleChange = (type, value) => {
    if (type === 'ship') setShipType(value);
    if (type === 'movement') setMovement(value);
    setResults({});
  };

  const calculateRow = async (index) => {
    const date = dates[index];
    if (!date) return;

    try {
      const response = await axios.get(`${API_URL}/windows`, {
        params: { ship_type: shipType, movement: movement, date: date },
        headers: { 'X-Auth-Token': apiToken }
      });
      setResults(prev => ({
        ...prev,
        [index]: response.data
      }));
    } catch (error) {
      console.error(`Error fetching for index ${index}`, error);
      let msg = "Error fetching data.";
      if (error.response && error.response.data && error.response.data.detail) {
        msg = error.response.data.detail;
      } else if (error.response && error.response.status === 404) {
        msg = "No data for this date.";
      } else if (error.response && error.response.status === 401) {
        msg = "Unauthorized (Invalid API Key)";
      }
      setResults(prev => ({
        ...prev,
        [index]: { error: msg }
      }));
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1 style={{ marginBottom: '0.5rem', marginTop: 0 }}>
          <span style={{
            fontSize: '1.5rem',
            color: '#1e3a8a', /* Dark Blue */
            fontWeight: '800',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            Port Otago
          </span>
        </h1>
        <h2 style={{
          margin: '0',
          color: '#64748b',
          fontWeight: '700',
          fontSize: '2.5rem'
        }}>
          Cruise Ship Window Calculator
        </h2>
      </header>
      <button
        onClick={handleLogout}
        style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>

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
  // Format Config Text e.g. "Princess Class Arrival Window"
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
  // Format: HH:mm - dd/mm/yy
  return `${hours}:${mins} - ${day}/${month}/${String(year).slice(-2)}`;
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 style={{ color: '#1e3a8a', marginBottom: '1.5rem' }}>Port Otago Operations</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Username"
            className="login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="login-btn">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
