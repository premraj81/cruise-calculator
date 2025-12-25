import React, { useState, useEffect } from 'react';
import './App.css';
import WindowCalculator from './WindowCalculator';
import BerthCalculator from './BerthCalculator';
import TideChart from './TideChart';
import OtherVesselCalculator from './OtherVesselCalculator';

function App() {
  // const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Login disabled for dev
  const [apiToken, setApiToken] = useState('CRUISE@ship25');
  const [currentView, setCurrentView] = useState('windows'); // 'windows', 'berth', 'tides'

  // State for WindowCalculator to persist when switching tabs
  const [shipType, setShipType] = useState('princess');
  const [movement, setMovement] = useState('arrival');
  const [dates, setDates] = useState(['']);
  const [results, setResults] = useState({});

  // Auto-logout
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
        setCurrentView('windows');
      }, 10 * 60 * 1000); // 10 mins
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();
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
    setCurrentView('windows');
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={(user, pass) => {
      if (user.trim() === 'PortOtago' && pass.trim() === 'CRUISE@ship25') {
        setApiToken(pass.trim());
        setIsLoggedIn(true);
      } else {
        alert('Invalid Credentials');
      }
    }} />;
  }

  // Navigation Keys
  const navItems = [
    { id: 'windows', label: 'Cruise Ship Window' },
    { id: 'berth', label: 'Beam Distance' },
    { id: 'tides', label: 'Tide Prediction Graph' },
    { id: 'other-vessels', label: 'Environmental Parameters & UKC' }
  ];

  return (
    <div className="App">
      <header className="app-header">
        <h1 style={{ marginBottom: '0.5rem', marginTop: 0 }}>
          <span style={{ fontSize: '1.5rem', color: '#1e3a8a', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Port Otago
          </span>
        </h1>
        {/* Dynamic Title based on View? Or just simpler header? */}
        <h2 style={{
          margin: '0.25rem 0 0 0',
          background: 'linear-gradient(to right, #92400e, #d97706, #92400e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: '400',
          fontSize: '1.8rem',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          fontFamily: '"Playfair Display", serif'
        }}>
          Marine Operation Tool
        </h2>

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
      </header>

      {/* Main Navigation */}
      <div className="nav-tabs" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: currentView === item.id ? '#1e3a8a' : '#e2e8f0',
              color: currentView === item.id ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              boxShadow: currentView === item.id ? '0 4px 6px -1px rgba(30, 58, 138, 0.4)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="content-area" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        {currentView === 'windows' && (
          <WindowCalculator
            shipType={shipType} setShipType={setShipType}
            movement={movement} setMovement={setMovement}
            dates={dates} setDates={setDates}
            results={results} setResults={setResults}
            apiToken={apiToken}
          />
        )}
        {currentView === 'berth' && <BerthCalculator />}
        {currentView === 'tides' && <TideChart />}
        {currentView === 'other-vessels' && <OtherVesselCalculator />}
      </div>
    </div>
  );
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
            type="text" placeholder="Username" className="login-input"
            value={username} onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password" placeholder="Password" className="login-input"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="login-btn">Login</button>
        </form>
      </div>
    </div>
  );
}

export default App;
