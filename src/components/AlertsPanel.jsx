import { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { loadJSON, saveJSON } from '../utils/storage.js';

export default function AlertsPanel() {
  const { state } = useDashboard();
  const [alerts, setAlerts] = useState(() => loadJSON('bloomberg_alerts') || []);
  const [triggered, setTriggered] = useState(() => loadJSON('bloomberg_triggered') || []);
  const [tab, setTab] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: '', condition: 'above', price: '' });

  useEffect(() => { saveJSON('bloomberg_alerts', alerts); }, [alerts]);
  useEffect(() => { saveJSON('bloomberg_triggered', triggered); }, [triggered]);

  const addAlert = () => {
    if (!form.symbol || !form.price) return;
    const newAlert = {
      id: Date.now().toString(),
      symbol: form.symbol.toUpperCase(),
      condition: form.condition,
      price: parseFloat(form.price),
      createdAt: new Date().toISOString(),
    };
    setAlerts(prev => [newAlert, ...prev]);
    setForm({ symbol: '', condition: 'above', price: '' });
    setShowForm(false);
  };

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearTriggered = () => setTriggered([]);

  return (
    <div className="panel">
      <h3 className="panel-title">
        Alerts & Monitoring
        <button className="alert-add-btn" onClick={() => setShowForm(!showForm)}>+ Create Alert</button>
      </h3>
      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Active ({alerts.length})</button>
        <button className={`tab-btn ${tab === 'triggered' ? 'active' : ''}`} onClick={() => setTab('triggered')}>Triggered ({triggered.length})</button>
      </div>

      {showForm && (
        <div className="alert-form">
          <input className="alert-input" placeholder="Symbol" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} />
          <select className="alert-select" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
            <option value="above">Price Above</option>
            <option value="below">Price Below</option>
          </select>
          <input className="alert-input" type="number" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <button className="alert-submit" onClick={addAlert}>Add</button>
        </div>
      )}

      {tab === 'active' ? (
        !alerts.length ? <p className="panel-empty">No active alerts</p> : (
          <div className="alerts-list">
            {alerts.map(a => (
              <div key={a.id} className="alert-row">
                <span className="alert-symbol">{a.symbol}</span>
                <span className="alert-condition">{a.condition === 'above' ? '>' : '<'} ${a.price.toFixed(2)}</span>
                <button className="alert-remove" onClick={() => removeAlert(a.id)}>x</button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {triggered.length > 0 && <button className="alert-clear" onClick={clearTriggered}>Clear All</button>}
          {!triggered.length ? <p className="panel-empty">No triggered alerts</p> : (
            <div className="alerts-list">
              {triggered.map((a, i) => (
                <div key={i} className="alert-row triggered">
                  <span className="alert-symbol">{a.symbol}</span>
                  <span className="alert-condition">{a.condition} ${a.price.toFixed(2)}</span>
                  <span className="alert-time">{new Date(a.triggeredAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
