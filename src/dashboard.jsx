import React, { useEffect, useMemo, useState } from 'react';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZ0AfEXG4l5_houa3nHrRMwmM-vbmdgkOOQG1QqQM20Wkka8juV5aUQ4a71H-mRjTNgGzikQrL7lEy/pub?gid=1940878227&single=true&output=csv';

function safeNumber(value) {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (!str) return 0;

  const cleaned = str
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function safePercent(value) {
  if (value === null || value === undefined) return 0;
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
  return result.map((cell) => cell.trim());
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
      {data.map((item, index) => {
        const gain = safeNumber(item.gananciaMensual);
        const height = maxValue > 0 ? Math.max(10, (gain / maxValue) * 140) : 10;

        return (
          <div key={`${item.mes}-${index}`} className="bar-wrap">
            <div className="bar-label-top">${gain.toLocaleString('es-AR')}</div>
            <div className="bar" style={{ height: `${height}px` }} />
            <div className="bar-label">{item.mes || '-'}</div>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(CSV_URL + '&cache=' + Date.now())
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((text) => {
        console.log('CSV crudo:', text);

        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== '');

        console.log('Líneas detectadas:', lines);

        if (lines.length <= 1) {
          setRows([]);
          setError('El CSV no tiene datos visibles.');
          setLoading(false);
          return;
        }

        const body = lines.slice(1).map(parseCsvLine);

        console.log('Filas parseadas:', body);

        const parsed = body
          .filter((r) => r && r.length >= 2)
          .map((r) => ({
            semaforo: r[0] || '',
            mes: r[1] || '',
            diasTrabajados: safeNumber(r[2]),
            diasNoTrabajados: safeNumber(r[3]),
            rendimiento: safePercent(r[4]),
            gananciaNetaMensual: safeNumber(r[5]),
            pagosChofer: safeNumber(r[6]),
            gastosVehiculo: safeNumber(r[7]),
            gananciaMensual: safeNumber(r[8]),
            valorDia: safeNumber(r[9]),
            gananciaAnual: safeNumber(r[10]),
          }))
          .filter((row) => row.mes !== '');

        console.log('Objeto final:', parsed);

        setRows(parsed);
        if (parsed.length === 0) {
          setError('No se encontraron filas válidas en la hoja Ganancias.');
        } else {
          setError('');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(`No se pudo cargar el Google Sheets: ${err.message}`);
        setRows([]);
        setLoading(false);
      });
  }, []);

  const current = useMemo(() => {
    if (!rows.length) return null;
    return rows[rows.length - 1];
  }, [rows]);

  const annualGain = useMemo(
    () => rows.reduce((acc, row) => acc + safeNumber(row.gananciaMensual), 0),
    [rows]
  );

  const previous = useMemo(() => {
    if (!current || rows.length < 2) return null;
    return rows[rows.length - 2];
  }, [rows, current]);

  const variation = useMemo(() => {
    if (!current || !previous) return null;

    const currentGain = safeNumber(current.gananciaMensual);
    const previousGain = safeNumber(previous.gananciaMensual);

    if (previousGain === 0) return null;

    return ((currentGain - previousGain) / previousGain) * 100;
  }, [current, previous]);

  const maxGain = useMemo(() => {
    if (!rows.length) return 0;
    return Math.max(...rows.map((r) => safeNumber(r.gananciaMensual)), 0);
  }, [rows]);

  const handleLogin = () => {
    if (password === '1234') {
      setIsLogged(true);
      setError('');
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

      {loading ? (
        <div className="card">
          <h2>Cargando datos...</h2>
          <p>Esperando respuesta de la hoja Ganancias.</p>
        </div>
      ) : current ? (
        <>
          <div className="stats-grid">
            <StatCard
              title="Ganancia del mes"
              value={`$${safeNumber(current.gananciaMensual).toLocaleString('es-AR')}`}
              hint={current.mes}
            />
            <StatCard
              title="Ganancia anual"
              value={`$${annualGain.toLocaleString('es-AR')}`}
            />
            <StatCard
              title="Rendimiento"
              value={`${safeNumber(current.rendimiento).toFixed(2)}%`}
            />
            <StatCard
              title="Días trabajados"
              value={String(safeNumber(current.diasTrabajados))}
            />
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
                <div>
                  <span>Mes</span>
                  <strong>{current.mes || '-'}</strong>
                </div>
                <div>
                  <span>Semáforo</span>
                  <strong>{current.semaforo || '-'}</strong>
                </div>
                <div>
                  <span>Pagos del chofer</span>
                  <strong>${safeNumber(current.pagosChofer).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Gastos del vehículo</span>
                  <strong>${safeNumber(current.gastosVehiculo).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Ganancia neta mensual</span>
                  <strong>${safeNumber(current.gananciaNetaMensual).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Valor día</span>
                  <strong>${safeNumber(current.valorDia).toLocaleString('es-AR')}</strong>
                </div>
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
                  {rows.map((row, index) => (
                    <tr key={`${row.mes}-${index}`}>
                      <td>{row.mes || '-'}</td>
                      <td>{safeNumber(row.diasTrabajados)}</td>
                      <td>{safeNumber(row.rendimiento).toFixed(2)}%</td>
                      <td>${safeNumber(row.gastosVehiculo).toLocaleString('es-AR')}</td>
                      <td>${safeNumber(row.gananciaMensual).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <h2>Sin datos para mostrar</h2>
          <p>La app cargó, pero no encontró filas válidas en la hoja Ganancias.</p>
        </div>
      )}
    </div>
  );
}
