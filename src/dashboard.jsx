import React, { useEffect, useMemo, useState } from 'react';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZ0AfEXG4l5_houa3nHrRMwmM-vbmdgkOOQG1QqQM20Wkka8juV5aUQ4a71H-mRjTNgGzikQrL7lEy/pub?gid=1940878227&single=true&output=csv';

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || '1234';

function safeNumber(value) {
  if (!value) return 0;
  let str = String(value).replace(/[^0-9,.-]/g, '');
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  if (lastComma > lastDot) str = str.replace(/\./g, '').replace(',', '.');
  else str = str.replace(/,/g, '');
  return Number(str) || 0;
}

function safePercent(value) {
  return Number(String(value).replace('%', '').replace(',', '.')) || 0;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
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

function getDebtStatus(debt) {
  if (debt <= 0) return { label: 'Al día', color: 'green' };
  if (debt < 300000) return { label: 'Atraso leve (<1 semana)', color: 'yellow' };
  if (debt <= 600000) return { label: 'Atraso >1 semana', color: 'orange' };
  return { label: 'Atraso crítico', color: 'red' };
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [password, setPassword] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('ultimo');

  useEffect(() => {
    fetch(CSV_URL + '&t=' + Date.now())
      .then((r) => r.text())
      .then((text) => {
        const lines = text.split('\n').filter((l) => l.trim());
        const data = lines.slice(1).map(parseCsvLine);

        const parsed = data.map((r) => ({
          mes: r[1],
          diasTrabajados: safeNumber(r[2]),
          diasNoTrabajados: safeNumber(r[3]),
          rendimiento: safePercent(r[4]),
          gananciaMensual: safeNumber(r[8]),
          pagosChofer: safeNumber(r[6]),
          gastos: safeNumber(r[7]),
        }));

        setRows(parsed);
      });
  }, []);

  const rowsWithData = rows.filter((r) => r.mes);

  const current =
    selectedMonth === 'ultimo'
      ? rowsWithData[rowsWithData.length - 1]
      : rowsWithData.find((r) => r.mes === selectedMonth);

  const previous = rowsWithData[rowsWithData.length - 2];

  const deudaMes = current
    ? current.gananciaMensual - current.pagosChofer
    : 0;

  const deudaAcumulada = rowsWithData.reduce(
    (acc, r) => acc + (r.gananciaMensual - r.pagosChofer),
    0
  );

  const deudaStatus = getDebtStatus(deudaMes);

  const porcentajePago = current
    ? (current.pagosChofer / current.gananciaMensual) * 100 || 0
    : 0;

  const promedioDia =
    current && current.diasTrabajados > 0
      ? current.gananciaMensual / current.diasTrabajados
      : 0;

  const proyeccion =
    promedioDia * (current?.diasTrabajados + current?.diasNoTrabajados || 0);

  const variacion =
    current && previous
      ? ((current.gananciaMensual - previous.gananciaMensual) /
          previous.gananciaMensual) *
        100
      : 0;

  if (!isLogged) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Acceso</h2>
        <input
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={() => password === APP_PASSWORD && setIsLogged(true)}>
          Ingresar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>AGILE DASHBOARD PRO</h1>

      <select onChange={(e) => setSelectedMonth(e.target.value)}>
        <option value="ultimo">Último</option>
        {rowsWithData.map((r) => (
          <option key={r.mes}>{r.mes}</option>
        ))}
      </select>

      <h2>{current?.mes}</h2>

      <div>
        <p>Ingreso: ${current?.gananciaMensual?.toLocaleString()}</p>
        <p>Pagado: ${current?.pagosChofer?.toLocaleString()}</p>
        <p>Gastos: ${current?.gastos?.toLocaleString()}</p>

        <hr />

        <h3>💰 Deuda del chofer</h3>
        <p>${deudaMes.toLocaleString()}</p>
        <p>{deudaStatus.label}</p>

        <h4>Acumulada: ${deudaAcumulada.toLocaleString()}</h4>

        <p>Pagó: {porcentajePago.toFixed(1)}%</p>

        <hr />

        <h3>📊 Proyección</h3>
        <p>${proyeccion.toLocaleString()}</p>

        <h3>📈 Tendencia</h3>
        <p>{variacion.toFixed(1)}%</p>
      </div>
    </div>
  );
}
