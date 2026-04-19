import React, { useEffect, useMemo, useState } from 'react';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZ0AfEXG4l5_houa3nHrRMwmM-vbmdgkOOQG1QqQM20Wkka8juV5aUQ4a71H-mRjTNgGzikQrL7lEy/pub?gid=1940878227&single=true&output=csv';

function parseMoney(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parsePercent(value) {
  if (!value) return 0;
  const cleaned = String(value).replace('%', '').replace(',', '.').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function StatCard({ title, value, hint }) {
  return (
    <div className="card stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

function BarMini({ data, maxValue }) {
  return (
    <div className="bars">
      {data.map((item) => {
        const height = maxValue > 0 ? Math.max(10, (item.ganancia / maxValue) * 140) : 10;
        return (
          <div key={item.mes} className="bar-wrap">
            <div className="bar-label-top">${item.ganancia.toLocaleString('es-AR')}</div>
            <div className="bar" style={{ height: `${height}px` }} />
            <div className="bar-label">{item.mes}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [password, setPassword] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(CSV_URL + '&cache=' + Date.now())
      .then((response) => response.text())
      .then((text) => {
  console.log(text);
        const lines = text.trim().split(/\r?\n/);
        const body = lines.slice(1).filter(Boolean).map(parseCsvLine);

        const parsed = body
          .filter((r) => r[1])
          .map((r) => ({
            semaforo: r[0] || '',
            mes: r[1] || '',
            diasTrabajados: Number(r[2] || 0),
            diasNoTrabajados: Number(r[3] || 0),
            rendimiento: parsePercent(r[4]),
            gananciaNetaMensual: parseMoney(r[5]),
            pagosChofer: parseMoney(r[6]),
            gastosVehiculo: parseMoney(r[7]),
            gananciaMensual: parseMoney(r[8]),
            valorDia: parseMoney(r[9]),
            gananciaAnual: parseMoney(r[10]),
          }));

        setRows(parsed);
      })
      .catch(() => {
        setError('No se pudo cargar el Google Sheets.');
      });
  }, []);

  const current = useMemo(() => {
    if (!rows.length) return null;
    return rows.find((r) => r.mes && r.gananciaMensual !== 0) || rows[rows.length - 1];
  }, [rows]);

  const annualGain = useMemo(
    () => rows.reduce((acc, row) => acc + row.gananciaMensual, 0),
    [rows]
  );

  const previous = useMemo(() => {
    if (!current) return null;
    const currentIndex = rows.findIndex((r) => r.mes === current.mes);
    if (currentIndex > 0) return rows[currentIndex - 1];
    return null;
  }, [rows, current]);

  const variation = useMemo(() => {
    if (!current || !previous || previous.gananciaMensual === 0) return null;
    return ((current.gananciaMensual - previous.gananciaMensual) / previous.gananciaMensual) * 100;
  }, [current, previous]);

  const maxGain = useMemo(
    () => Math.max(...rows.map((r) => r.gananciaMensual), 0),
    [rows]
  );

  const handleLogin = () => {
    if (password === '1234') {
      setIsLogged(true);
    } else {
      setError('Contraseña incorrecta.');
    }
  };

  if (!isLogged) {
    return (
      <div className="login-page">
        <div className="card login-card">
          <h1>🔒 Acceso privado</h1>
          <p>Ingresá tu contraseña para ver el tablero del Agile.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="Contraseña"
          />
          <button onClick={handleLogin}>Ingresar</button>
          <div className="login-help">Contraseña actual: 1234</div>
          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1>AGILE DASHBOARD PRO</h1>
          <p>Actualización automática desde Google Sheets</p>
        </div>
        <div className="pill">Modo oscuro • iPhone y PC</div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {current ? (
        <>
          <div className="stats-grid">
            <StatCard title="Ganancia del mes" value={`$${current.gananciaMensual.toLocaleString('es-AR')}`} hint={current.mes} />
            <StatCard title="Ganancia anual" value={`$${annualGain.toLocaleString('es-AR')}`} />
            <StatCard title="Rendimiento" value={`${current.rendimiento.toFixed(2)}%`} />
            <StatCard title="Días trabajados" value={String(current.diasTrabajados)} />
            <StatCard
              title="Vs mes anterior"
              value={variation === null ? 'Sin dato' : `${variation.toFixed(1)}%`}
              hint={previous ? `Comparado con ${previous.mes}` : ''}
            />
          </div>

          <div className="grid-two">
            <div className="card">
              <h2>Ganancia por mes</h2>
              <BarMini data={rows} maxValue={maxGain} />
            </div>

            <div className="card">
              <h2>Mes actual</h2>
              <div className="detail-list">
                <div><span>Mes</span><strong>{current.mes}</strong></div>
                <div><span>Semáforo</span><strong>{current.semaforo || '-'}</strong></div>
                <div><span>Pagos del chofer</span><strong>${current.pagosChofer.toLocaleString('es-AR')}</strong></div>
                <div><span>Gastos del vehículo</span><strong>${current.gastosVehiculo.toLocaleString('es-AR')}</strong></div>
                <div><span>Ganancia neta mensual</span><strong>${current.gananciaNetaMensual.toLocaleString('es-AR')}</strong></div>
                <div><span>Valor día</span><strong>${current.valorDia.toLocaleString('es-AR')}</strong></div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Resumen mensual</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Días trabajados</th>
                    <th>Rendimiento</th>
                    <th>Gastos</th>
                    <th>Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.mes}>
                      <td>{row.mes}</td>
                      <td>{row.diasTrabajados}</td>
                      <td>{row.rendimiento.toFixed(2)}%</td>
                      <td>${row.gastosVehiculo.toLocaleString('es-AR')}</td>
                      <td>${row.gananciaMensual.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <h2>Cargando datos...</h2>
          <p>Esperando información de la hoja Ganancias.</p>
        </div>
      )}
    </div>
  );
}
