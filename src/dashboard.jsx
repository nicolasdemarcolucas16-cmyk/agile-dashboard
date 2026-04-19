import React, { useEffect, useMemo, useState } from 'react';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZ0AfEXG4l5_houa3nHrRMwmM-vbmdgkOOQG1QqQM20Wkka8juV5aUQ4a71H-mRjTNgGzikQrL7lEy/pub?gid=1940878227&single=true&output=csv';

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || '1234';
const INVESTMENT_TOTAL = 10000000; // podés cambiarlo más adelante

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

  if (text.includes('verde') || rendimiento >= 80) {
    return { label: 'Verde', className: 'green' };
  }
  if (text.includes('amar') || rendimiento >= 50) {
    return { label: 'Amarillo', className: 'yellow' };
  }
  return { label: 'Rojo', className: 'red' };
}

function getDebtStatus(debt) {
  const value = safeNumber(debt);

  if (value <= 0) {
    return {
      label: 'Al día',
      className: 'green',
      hint: 'Sin deuda pendiente',
    };
  }

  if (value < 300000) {
    return {
      label: 'Atraso menor a una semana',
      className: 'yellow',
      hint: 'Debe menos de $300.000',
    };
  }

  if (value <= 600000) {
    return {
      label: 'Atraso mayor a una semana',
      className: 'orange',
      hint: 'Debe entre $300.000 y $600.000',
    };
  }

  return {
    label: 'Atraso crítico',
    className: 'red',
    hint: 'Debe más de $600.000',
  };
}

function formatCurrency(value) {
  return `$${safeNumber(value).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
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
              <span>{formatCurrency(ingresos)}</span>
              <span>{formatCurrency(gastos)}</span>
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

function TrendBadge({ label, value, positiveIsGood = true }) {
  if (value === null || Number.isNaN(value)) {
    return <div className="trend neutral">{label}: Sin dato</div>;
  }

  const isPositive = value >= 0;
  const good = positiveIsGood ? isPositive : !isPositive;

  return (
    <div className={`trend ${good ? 'good' : 'bad'}`}>
      {label}: {isPositive ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </div>
  );
}

function AlertBanner({ type, text }) {
  return <div className={`alert-banner ${type}`}>{text}</div>;
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

  const annualIncome = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.gananciaMensual), 0);
  }, [rowsWithData]);

  const annualExpenses = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.gastosVehiculo), 0);
  }, [rowsWithData]);

  const annualDays = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.diasTrabajados), 0);
  }, [rowsWithData]);

  const annualPayments = useMemo(() => {
    return rowsWithData.reduce((acc, row) => acc + safeNumber(row.pagosChofer), 0);
  }, [rowsWithData]);

  const accumulatedDebt = useMemo(() => {
    return rowsWithData.reduce(
      (acc, row) => acc + (safeNumber(row.gananciaMensual) - safeNumber(row.pagosChofer)),
      0
    );
  }, [rowsWithData]);

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

  const monthlyVariation = useMemo(() => {
    if (!current || !previous) return null;
    const currentGain = safeNumber(current.gananciaMensual);
    const previousGain = safeNumber(previous.gananciaMensual);
    if (previousGain === 0) return null;
    return ((currentGain - previousGain) / previousGain) * 100;
  }, [current, previous]);

  const rolling3 = useMemo(() => {
    if (!rowsWithData.length) return [];
    return rowsWithData.slice(-3);
  }, [rowsWithData]);

  const averageLast3Months = useMemo(() => {
    if (!rolling3.length) return 0;
    return rolling3.reduce((acc, row) => acc + safeNumber(row.gananciaMensual), 0) / rolling3.length;
  }, [rolling3]);

  const trendVsAverage3 = useMemo(() => {
    if (!current || averageLast3Months === 0) return null;
    return ((safeNumber(current.gananciaMensual) - averageLast3Months) / averageLast3Months) * 100;
  }, [current, averageLast3Months]);

  const projectedMonthIncome = useMemo(() => {
    if (!current) return 0;
    const worked = safeNumber(current.diasTrabajados);
    const notWorked = safeNumber(current.diasNoTrabajados);
    const totalKnown = worked + notWorked;

    if (worked === 0) return 0;
    if (totalKnown > 0) {
      return averagePerDay * totalKnown;
    }
    return averagePerDay * worked;
  }, [current, averagePerDay]);

  const currentDebt = useMemo(() => {
    if (!current) return 0;
    return safeNumber(current.gananciaMensual) - safeNumber(current.pagosChofer);
  }, [current]);

  const currentNetCollected = useMemo(() => {
    if (!current) return 0;
    return safeNumber(current.pagosChofer) - safeNumber(current.gastosVehiculo);
  }, [current]);

  const currentPending = useMemo(() => {
    if (!current) return 0;
    return Math.max(0, safeNumber(current.gananciaMensual) - safeNumber(current.pagosChofer));
  }, [current]);

  const paidRatio = useMemo(() => {
    if (!current) return 0;
    const generated = safeNumber(current.gananciaMensual);
    if (generated <= 0) return 0;
    return (safeNumber(current.pagosChofer) / generated) * 100;
  }, [current]);

  const roiRecovered = useMemo(() => {
    return annualPayments - annualExpenses;
  }, [annualPayments, annualExpenses]);

  const roiPercent = useMemo(() => {
    if (INVESTMENT_TOTAL <= 0) return 0;
    return (roiRecovered / INVESTMENT_TOTAL) * 100;
  }, [roiRecovered]);

  const investmentRemaining = useMemo(() => {
    return Math.max(0, INVESTMENT_TOTAL - roiRecovered);
  }, [roiRecovered]);

  const semaforo = current ? getSemaforoInfo(current.semaforo, current.rendimiento) : null;
  const debtStatus = getDebtStatus(currentDebt);
  const accumulatedDebtStatus = getDebtStatus(accumulatedDebt);

  const alerts = useMemo(() => {
    if (!current) return [];

    const result = [];
    const rendimiento = safeNumber(current.rendimiento);
    const gastos = safeNumber(current.gastosVehiculo);
    const ingreso = safeNumber(current.gananciaMensual);
    const debt = safeNumber(currentDebt);

    if (rendimiento < 50) {
      result.push({
        type: 'danger',
        text: `Rendimiento bajo en ${current.mes}: ${rendimiento.toFixed(2)}%.`,
      });
    } else if (rendimiento < 80) {
      result.push({
        type: 'warning',
        text: `Rendimiento intermedio en ${current.mes}: ${rendimiento.toFixed(2)}%.`,
      });
    }

    if (debt > 600000) {
      result.push({
        type: 'danger',
        text: `El chofer tiene un atraso crítico en ${current.mes}: ${formatCurrency(debt)}.`,
      });
    } else if (debt >= 300000) {
      result.push({
        type: 'warning',
        text: `El chofer tiene un atraso mayor a una semana en ${current.mes}: ${formatCurrency(debt)}.`,
      });
    } else if (debt > 0) {
      result.push({
        type: 'warning',
        text: `El chofer tiene un atraso menor a una semana en ${current.mes}: ${formatCurrency(debt)}.`,
      });
    }

    if (incomeIsBestMonth(rowsWithData, current)) {
      result.push({
        type: 'success',
        text: `${current.mes} es el mejor mes del historial por ingreso.`,
      });
    }

    if (monthlyVariation !== null && monthlyVariation < -10) {
      result.push({
        type: 'danger',
        text: `La ganancia cayó ${Math.abs(monthlyVariation).toFixed(1)}% vs ${previous?.mes}.`,
      });
    }

    if (previous && gastos > safeNumber(previous.gastosVehiculo) * 1.25) {
      result.push({
        type: 'warning',
        text: `Los gastos subieron fuerte respecto a ${previous.mes}.`,
      });
    }

    if (result.length === 0 && ingreso > 0) {
      result.push({
        type: 'success',
        text: `Mes estable. Seguimiento correcto de ${current.mes}.`,
      });
    }

    return result;
  }, [current, monthlyVariation, previous, rowsWithData, currentDebt]);

  function incomeIsBestMonth(data, selected) {
    if (!selected || !data.length) return false;
    const best = data.reduce((a, b) =>
      safeNumber(a.gananciaMensual) >= safeNumber(b.gananciaMensual) ? a : b
    );
    return best.mes === selected.mes;
  }

  const handleLogin = () => {
    if (password === APP_PASSWORD) {
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
          <div className="login-help">La contraseña ya no está fija en el código.</div>
          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    );
  }

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
          max-width: 1320px;
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
        .accent-orange { border-color: #d97706; }

        .grid-two {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
          margin-bottom: 18px;
        }
        .grid-two-equal {
          display: grid;
          grid-template-columns: 1fr 1fr;
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
        .status-dot.orange { background: #fb923c; }

        .trend-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }
        .trend {
          border-radius: 14px;
          padding: 14px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .trend.good {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.3);
          color: #86efac;
        }
        .trend.bad {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }
        .trend.neutral {
          background: rgba(96, 165, 250, 0.12);
          border-color: rgba(96, 165, 250, 0.3);
          color: #93c5fd;
        }

        .alerts {
          display: grid;
          gap: 10px;
          margin-bottom: 18px;
        }
        .alert-banner {
          padding: 14px 16px;
          border-radius: 14px;
          font-weight: 600;
          border: 1px solid transparent;
        }
        .alert-banner.success {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.35);
          color: #86efac;
        }
        .alert-banner.warning {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.35);
          color: #fcd34d;
        }
        .alert-banner.danger {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.35);
          color: #fca5a5;
        }

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
          .grid-two,
          .grid-two-equal,
          .trend-row {
            grid-template-columns: 1fr;
          }
        }
       
