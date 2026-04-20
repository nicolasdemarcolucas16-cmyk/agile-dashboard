import React, { useEffect, useMemo, useState } from 'react';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZ0AfEXG4l5_houa3nHrRMwmM-vbmdgkOOQG1QqQM20Wkka8juV5aUQ4a71H-mRjTNgGzikQrL7lEy/pub?gid=1940878227&single=true&output=csv';

function safeNumber(value) {
  if (value === null || value === undefined) return 0;

  let str = String(value).trim();
  if (!str) return 0;

  str = str.replace(/[^0-9,.-]/g, '');

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma > lastDot) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    str = str.replace(/,/g, '');
  } else {
    str = str.replace(',', '.');
  }

  const num = Number(str);
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

function getSemaforoInfo(semaforo, rendimiento) {
  const text = String(semaforo || '').toLowerCase();

  if (text.includes('verde') || rendimiento >= 85) {
    return { label: 'Verde', className: 'green' };
  }
  if (text.includes('amar') || rendimiento >= 60) {
    return { label: 'Amarillo', className: 'yellow' };
  }
  return { label: 'Rojo', className: 'red' };
}

function StatCard({ title, value, hint, accent = 'blue' }) {
  return (
    <div className={`card stat-card accent-${accent}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

function BarsComparison({ data, maxValue }) {
  return (
    <div className="bars-comparison">
      {data.map((item, index) => {
        const ingresos = safeNumber(item.gananciaMensual);
        const gastos = safeNumber(item.gastosVehiculo);
        const ingresoHeight = maxValue > 0 ? Math.max(10, (ingresos / maxValue) * 140) : 10;
        const gastoHeight = maxValue > 0 ? Math.max(10, (gastos / maxValue) * 140) : 10;

        return (
          <div key={`${item.mes}-${index}`} className="bar-group">
            <div className="bar-values">
              <span>${ingresos.toLocaleString('es-AR')}</span>
              <span>${gastos.toLocaleString('es-AR')}</span>
            </div>
            <div className="bar-pair">
              <div className="bar ingreso" style={{ height: `${ingresoHeight}px` }} />
              <div className="bar gasto" style={{ height: `${gastoHeight}px` }} />
            </div>
            <div className="bar-legend">
              <span className="legend ingreso-dot">Ingreso</span>
              <span className="legend gasto-dot">Gasto</span>
            </div>
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
  const [selectedMonth, setSelectedMonth] = useState('ultimo');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);

    fetch(CSV_URL + '&cache=' + Date.now() + '-' + refreshKey)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((text) => {
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== '');

        if (lines.length <= 1) {
          setRows([]);
          setError('El CSV no tiene datos visibles.');
          setLoading(false);
          return;
        }

        const body = lines.slice(1).map(parseCsvLine);

        const parsed = body
          .filter((r) => r && r.length >= 11)
          .map((r) => ({
            semaforo: r[0] || '',
            mes: (r[1] || '').trim(),
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
          .filter((row) => row.mes !== '' && row.mes.toLowerCase() !== 'mes');

        setRows(parsed);
        setError(parsed.length === 0 ? 'No se encontraron filas válidas en la hoja Ganancias.' : '');
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(`No se pudo cargar el Google Sheets: ${err.message}`);
        setRows([]);
        setLoading(false);
      });
  }, [refreshKey]);

  const rowsWithData = useMemo(() => {
    return rows.filter(
      (row) =>
        safeNumber(row.gananciaMensual) > 0 ||
        safeNumber(row.diasTrabajados) > 0 ||
        safeNumber(row.gananciaNetaMensual) > 0 ||
        safeNumber(row.gastosVehiculo) > 0 ||
        safeNumber(row.pagosChofer) > 0
    );
  }, [rows]);

  const availableMonths = useMemo(() => rowsWithData.map((row) => row.mes), [rowsWithData]);

  const current = useMemo(() => {
    if (!rowsWithData.length) return null;

    if (selectedMonth === 'ultimo') {
      return rowsWithData[rowsWithData.length - 1];
    }

    return rowsWithData.find((row) => row.mes === selectedMonth) || rowsWithData[rowsWithData.length - 1];
  }, [rowsWithData, selectedMonth]);

  const previous = useMemo(() => {
    if (!current || rowsWithData.length < 2) return null;
    const currentIndex = rowsWithData.findIndex((row) => row.mes === current.mes);
    if (currentIndex > 0) return rowsWithData[currentIndex - 1];
    return null;
  }, [rowsWithData, current]);

  const annualGain = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.gananciaMensual), 0);
  }, [rowsWithData]);

  const annualExpenses = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.gastosVehiculo), 0);
  }, [rowsWithData]);

  const annualDays = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.diasTrabajados), 0);
  }, [rowsWithData]);

  const totalGeneradoHistorico = useMemo(() => {
    return rowsWithData.reduce(
      (acc, row) => acc + safeNumber(row.diasTrabajados) * safeNumber(row.valorDia),
      0
    );
  }, [rowsWithData]);

  const totalPagadoHistorico = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.pagosChofer), 0);
  }, [rowsWithData]);

  const variation = useMemo(() => {
    if (!current || !previous) return null;
    const currentGain = safeNumber(current.gananciaMensual);
    const previousGain = safeNumber(previous.gananciaMensual);
    if (previousGain === 0) return null;
    return ((currentGain - previousGain) / previousGain) * 100;
  }, [current, previous]);

  const averagePerDay = useMemo(() => {
    if (!current) return 0;
    const days = safeNumber(current.diasTrabajados);
    if (days === 0) return 0;
    return safeNumber(current.gananciaMensual) / days;
  }, [current]);

  const maxChartValue = useMemo(() => {
    if (!rowsWithData.length) return 0;
    return Math.max(
      ...rowsWithData.flatMap((r) => [safeNumber(r.gananciaMensual), safeNumber(r.gastosVehiculo)]),
      0
    );
  }, [rowsWithData]);

  const projectedMonth = useMemo(() => {
    if (!current) return 0;
    const worked = safeNumber(current.diasTrabajados);
    const notWorked = safeNumber(current.diasNoTrabajados);
    const totalExpected = worked + notWorked;
    if (worked === 0 || totalExpected === 0) return 0;
    return averagePerDay * totalExpected;
  }, [current, averagePerDay]);

  const generadoMesActual = useMemo(() => {
    if (!current) return 0;
    return safeNumber(current.diasTrabajados) * safeNumber(current.valorDia);
  }, [current]);

  const gananciaReal = useMemo(() => {
    if (!current) return 0;
    return safeNumber(current.pagosChofer) - safeNumber(current.gastosVehiculo);
  }, [current]);

  const pendienteMesActual = useMemo(() => {
    if (!current) return 0;
    return Math.max(0, generadoMesActual - safeNumber(current.pagosChofer));
  }, [current, generadoMesActual]);

  const pendienteAcumulado = useMemo(() => {
    const total = rowsWithData.reduce((acc, row) => {
      const generado = safeNumber(row.diasTrabajados) * safeNumber(row.valorDia);
      const pagado = safeNumber(row.pagosChofer);
      return acc + (generado - pagado);
    }, 0);

    return Math.max(0, total);
  }, [rowsWithData]);

  const porcentajeCobrado = useMemo(() => {
    if (!current) return 0;
    if (generadoMesActual === 0) return 0;
    return (safeNumber(current.pagosChofer) / generadoMesActual) * 100;
  }, [current, generadoMesActual]);

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

  const semaforo = current ? getSemaforoInfo(current.semaforo, current.rendimiento) : null;

  return (
    <div className="page">
      <style>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #07142b;
          color: #e8eefc;
        }
        .page {
          padding: 20px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .topbar h1 {
          margin: 0;
          font-size: 28px;
        }
        .topbar p {
          margin: 8px 0 0;
          color: #9bb0d3;
        }
        .topbar-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .pill {
          background: #0d1c39;
          border: 1px solid #203760;
          padding: 10px 14px;
          border-radius: 999px;
          color: #d5e2fb;
          font-size: 14px;
        }
        .card {
          background: #08162f;
          border: 1px solid #1d345b;
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.18);
        }
        .filters {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .filters select,
        .filters button,
        .login-card button {
          background: #112446;
          color: white;
          border: 1px solid #28436f;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          cursor: pointer;
        }
        .filters button:hover,
        .login-card button:hover {
          opacity: 0.95;
        }
        .filters select {
          min-width: 190px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }
        .stat-card {
          min-height: 120px;
        }
        .stat-title {
          color: #9bb0d3;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .stat-value {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.2;
        }
        .stat-hint {
          margin-top: 8px;
          color: #72b3ff;
          font-size: 13px;
        }
        .accent-blue { border-color: #1f63c0; }
        .accent-green { border-color: #1c8d63; }
        .accent-red { border-color: #a53b4f; }
        .accent-yellow { border-color: #b2892c; }

        .grid-two {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
          margin-bottom: 18px;
        }
        .bars-comparison {
          display: flex;
          align-items: end;
          gap: 18px;
          min-height: 250px;
          overflow-x: auto;
          padding-top: 14px;
        }
        .bar-group {
          min-width: 140px;
          text-align: center;
        }
        .bar-values {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #a9c9ff;
          font-size: 11px;
          min-height: 32px;
        }
        .bar-pair {
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 8px;
          height: 160px;
        }
        .bar {
          width: 28px;
          border-radius: 12px 12px 0 0;
        }
        .bar.ingreso {
          background: linear-gradient(180deg, #3cb8ff 0%, #2563eb 100%);
        }
        .bar.gasto {
          background: linear-gradient(180deg, #ff9b57 0%, #d35400 100%);
        }
        .bar-label {
          margin-top: 8px;
          font-size: 14px;
          color: #e8eefc;
        }
        .bar-legend {
          margin-top: 8px;
          display: flex;
          justify-content: center;
          gap: 10px;
          font-size: 12px;
          color: #9bb0d3;
        }
        .legend::before {
          content: '';
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
        }
        .ingreso-dot::before { background: #3cb8ff; }
        .gasto-dot::before { background: #ff9b57; }

        .detail-list {
          display: grid;
          gap: 12px;
        }
        .detail-list div {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid #142748;
        }
        .detail-list span {
          color: #9bb0d3;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-dot.red { background: #ff5f7a; }
        .status-dot.yellow { background: #ffd166; }
        .status-dot.green { background: #32d296; }

        .table-wrap {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          text-align: left;
          padding: 12px 10px;
          border-bottom: 1px solid #142748;
        }
        th {
          color: #72b3ff;
          font-weight: 600;
        }
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
        }
        .login-card h1 {
          margin-top: 0;
        }
        .login-card p {
          color: #9bb0d3;
        }
        .login-card input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid #334155;
          background: #020617;
          color: white;
          margin-top: 12px;
          margin-bottom: 12px;
          font-size: 16px;
        }
        .login-help {
          margin-top: 12px;
          color: #9bb0d3;
          font-size: 13px;
        }
        .error, .error-banner {
          margin-top: 12px;
          color: #fecaca;
          background: rgba(127, 29, 29, 0.35);
          border: 1px solid rgba(248, 113, 113, 0.4);
          padding: 12px;
          border-radius: 12px;
        }
        .error-banner {
          margin-bottom: 18px;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .grid-two {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 700px) {
          .page {
            padding: 14px;
          }
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .topbar h1 {
            font-size: 24px;
          }
          .stat-value {
            font-size: 24px;
          }
        }
      `}</style>

      <div className="topbar">
        <div>
          <h1>AGILE DASHBOARD PRO</h1>
          <p>Actualización automática desde Google Sheets</p>
        </div>
        <div className="topbar-actions">
          <div className="pill">Modo oscuro • iPhone y PC</div>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="filters">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          <option value="ultimo">Último mes con datos</option>
          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>

        <button onClick={() => setRefreshKey((prev) => prev + 1)}>
          Actualizar datos
        </button>
      </div>

      {loading ? (
        <div className="card">
          <h2>Cargando datos...</h2>
          <p>Esperando respuesta de la hoja Ganancias.</p>
        </div>
      ) : current ? (
        <>
          <div className="stats-grid">
            <StatCard
              title="Ingreso del mes"
              value={`$${safeNumber(current.gananciaMensual).toLocaleString('es-AR')}`}
              hint={current.mes}
              accent="blue"
            />
            <StatCard
              title="Pagos recibidos"
              value={`$${safeNumber(current.pagosChofer).toLocaleString('es-AR')}`}
              accent="blue"
            />
            <StatCard
              title="Gastos del mes"
              value={`$${safeNumber(current.gastosVehiculo).toLocaleString('es-AR')}`}
              accent="red"
            />
            <StatCard
              title="Ganancia real"
              value={`$${safeNumber(gananciaReal).toLocaleString('es-AR')}`}
              hint="Pagos - gastos"
              accent="green"
            />
            <StatCard
              title="Pendiente del mes"
              value={`$${safeNumber(pendienteMesActual).toLocaleString('es-AR')}`}
              hint={`${safeNumber(porcentajeCobrado).toFixed(1)}% cobrado`}
              accent="yellow"
            />
            <StatCard
              title="Pendiente acumulado"
              value={`$${safeNumber(pendienteAcumulado).toLocaleString('es-AR')}`}
              hint="Todos los meses"
              accent="yellow"
            />
          </div>

          <div className="grid-two">
            <div className="card">
              <h2>Ingresos vs gastos por mes</h2>
              <BarsComparison data={rowsWithData} maxValue={maxChartValue} />
            </div>

            <div className="card">
              <h2>Mes seleccionado</h2>
              <div className="detail-list">
                <div>
                  <span>Mes</span>
                  <strong>{current.mes || '-'}</strong>
                </div>
                <div>
                  <span>Semáforo</span>
                  <strong className="status-badge">
                    <span className={`status-dot ${semaforo.className}`} />
                    {semaforo.label}
                  </strong>
                </div>
                <div>
                  <span>Generado del mes</span>
                  <strong>${safeNumber(generadoMesActual).toLocaleString('es-AR')}</strong>
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
                  <span>Ganancia real al momento</span>
                  <strong>${safeNumber(gananciaReal).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Pendiente del mes</span>
                  <strong>${safeNumber(pendienteMesActual).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Pendiente acumulado</span>
                  <strong>${safeNumber(pendienteAcumulado).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Valor día</span>
                  <strong>${safeNumber(current.valorDia).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Promedio por día</span>
                  <strong>${safeNumber(averagePerDay).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Proyección del mes</span>
                  <strong>${safeNumber(projectedMonth).toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span>Vs mes anterior</span>
                  <strong>
                    {variation === null ? 'Sin dato' : `${safeNumber(variation).toFixed(1)}%`}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <StatCard
              title="Total generado histórico"
              value={`$${safeNumber(totalGeneradoHistorico).toLocaleString('es-AR')}`}
              accent="blue"
            />
            <StatCard
              title="Total pagado histórico"
              value={`$${safeNumber(totalPagadoHistorico).toLocaleString('es-AR')}`}
              accent="green"
            />
            <StatCard
              title="Ingreso anual acumulado"
              value={`$${annualGain.toLocaleString('es-AR')}`}
              accent="blue"
            />
            <StatCard
              title="Gastos anuales"
              value={`$${annualExpenses.toLocaleString('es-AR')}`}
              accent="red"
            />
            <StatCard
              title="Días trabajados anuales"
              value={String(annualDays)}
              accent="yellow"
            />
            <StatCard
              title="Meses con datos"
              value={String(rowsWithData.length)}
              accent="green"
            />
          </div>

          <div className="card">
            <h2>Resumen mensual</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Días trabajados</th>
                    <th>Días no trabajados</th>
                    <th>Rendimiento</th>
                    <th>Generado</th>
                    <th>Pagos chofer</th>
                    <th>Gastos</th>
                    <th>Ganancia real</th>
                    <th>Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithData.map((row, index) => {
                    const generado = safeNumber(row.diasTrabajados) * safeNumber(row.valorDia);
                    const real = safeNumber(row.pagosChofer) - safeNumber(row.gastosVehiculo);
                    const pendiente = Math.max(0, generado - safeNumber(row.pagosChofer));

                    return (
                      <tr key={`${row.mes}-${index}`}>
                        <td>{row.mes || '-'}</td>
                        <td>{safeNumber(row.diasTrabajados)}</td>
                        <td>{safeNumber(row.diasNoTrabajados)}</td>
                        <td>{safeNumber(row.rendimiento).toFixed(2)}%</td>
                        <td>${safeNumber(generado).toLocaleString('es-AR')}</td>
                        <td>${safeNumber(row.pagosChofer).toLocaleString('es-AR')}</td>
                        <td>${safeNumber(row.gastosVehiculo).toLocaleString('es-AR')}</td>
                        <td>${safeNumber(real).toLocaleString('es-AR')}</td>
                        <td>${safeNumber(pendiente).toLocaleString('es-AR')}</td>
                      </tr>
                    );
                  })}
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
