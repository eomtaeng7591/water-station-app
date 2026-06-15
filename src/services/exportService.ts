import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './apiClient';
import { MonthlySummary } from '../types';

interface ExportOrder {
  receipt_no: string;
  customer_name: string;
  order_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_type: string;
  delivery_status: string;
}

interface ExportSummary {
  date: string;
  order_count: number;
  walkin_total: number;
  delivery_total: number;
  cash_total: number;
  ewallet_total: number;
  credit_total: number;
  grand_total: number;
}

async function fetchDailyReport(date: string) {
  return api.get<{ summary: ExportSummary; orders: ExportOrder[] }>(`/reports/daily?date=${date}`);
}

export async function exportDailyCSV(date: string): Promise<void> {
  const { summary, orders } = await fetchDailyReport(date);

  const lines = [
    'Receipt No,Customer,Type,Qty,Unit Price,Total,Payment,Status',
    ...orders.map(o =>
      [
        o.receipt_no,
        `"${o.customer_name}"`,
        o.order_type,
        o.quantity,
        Number(o.unit_price).toFixed(2),
        Number(o.total_amount).toFixed(2),
        o.payment_type,
        o.delivery_status,
      ].join(',')
    ),
    '',
    `Date,${summary.date}`,
    `Orders,${summary.order_count}`,
    `Walk-in Total,${summary.walkin_total.toFixed(2)}`,
    `Delivery Total,${summary.delivery_total.toFixed(2)}`,
    `Cash Total,${summary.cash_total.toFixed(2)}`,
    `E-Wallet Total,${summary.ewallet_total.toFixed(2)}`,
    `Credit Total,${summary.credit_total.toFixed(2)}`,
    `Grand Total,${summary.grand_total.toFixed(2)}`,
  ];

  const fileUri = `${FileSystem.documentDirectory}PurefectSales_${date}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: `Sales Report ${date}`,
    UTI: 'public.comma-separated-values-text',
  });
}

export async function exportDailyPDF(date: string): Promise<void> {
  const { summary, orders } = await fetchDailyReport(date);

  const rowsHtml = orders.length
    ? orders
        .map(
          (o, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td>${o.receipt_no}</td>
        <td>${o.customer_name}</td>
        <td><span class="${o.order_type === 'DELIVERY' ? 'del' : 'wal'}">${o.order_type}</span></td>
        <td style="text-align:center">${o.quantity}</td>
        <td style="text-align:right">&#8369;${Number(o.unit_price).toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">&#8369;${Number(o.total_amount).toFixed(2)}</td>
        <td>${o.payment_type}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="7" style="text-align:center;color:#999;padding:24px">No orders on this date</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:28px;color:#1a1a1a;font-size:13px}
  .hdr{text-align:center;margin-bottom:24px}
  .hdr h1{color:#1D9E75;margin:0 0 4px;font-size:22px}
  .hdr p{color:#666;margin:0}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:#1D9E75;color:#fff;padding:9px 10px;text-align:left;font-size:12px}
  td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px}
  .del{background:#EFF6FF;color:#1D4ED8;padding:2px 7px;border-radius:4px;font-size:11px}
  .wal{background:#F0FDF4;color:#15803D;padding:2px 7px;border-radius:4px;font-size:11px}
  .grid{display:flex;flex-wrap:wrap;gap:10px}
  .card{flex:1;min-width:130px;background:#f8f8f8;border-radius:8px;padding:12px 14px}
  .card .lbl{font-size:11px;color:#888;margin-bottom:3px}
  .card .val{font-size:16px;font-weight:700;color:#1D9E75}
  .grand{background:#1D9E75;color:#fff;border-radius:10px;padding:16px;text-align:center;margin-top:14px}
  .grand .lbl{font-size:11px;opacity:.85;margin-bottom:2px}
  .grand .val{font-size:28px;font-weight:700}
</style>
</head><body>
<div class="hdr">
  <h1>Purefect Water Station</h1>
  <p>Daily Sales Report &nbsp;&middot;&nbsp; ${summary.date}</p>
</div>
<table>
  <thead><tr><th>Receipt</th><th>Customer</th><th>Type</th><th>Qty</th><th>Price</th><th>Total</th><th>Payment</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="grid">
  <div class="card"><div class="lbl">Orders</div><div class="val">${summary.order_count}</div></div>
  <div class="card"><div class="lbl">Walk-in</div><div class="val">&#8369;${summary.walkin_total.toLocaleString()}</div></div>
  <div class="card"><div class="lbl">Delivery</div><div class="val">&#8369;${summary.delivery_total.toLocaleString()}</div></div>
  <div class="card"><div class="lbl">Cash</div><div class="val">&#8369;${summary.cash_total.toLocaleString()}</div></div>
  <div class="card"><div class="lbl">E-Wallet</div><div class="val">&#8369;${summary.ewallet_total.toLocaleString()}</div></div>
  <div class="card"><div class="lbl">Credit</div><div class="val">&#8369;${summary.credit_total.toLocaleString()}</div></div>
</div>
<div class="grand">
  <div class="lbl">GRAND TOTAL</div>
  <div class="val">&#8369;${summary.grand_total.toLocaleString()}</div>
</div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const destUri = `${FileSystem.documentDirectory}PurefectSales_${date}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: destUri });
  await Sharing.shareAsync(destUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Sales Report ${date}`,
    UTI: 'com.adobe.pdf',
  });
}

export async function exportMonthlyCSV(year: number, month: number): Promise<void> {
  const data = await api.get<MonthlySummary>(`/reports/monthly?year=${year}&month=${month}`);
  const monthLabel = `${year}-${String(month).padStart(2, '0')}`;

  const lines = [
    'Date,Walk-in,Delivery,Total',
    ...data.days.map(d =>
      [
        d.date,
        Number(d.walkin_sales).toFixed(2),
        Number(d.delivery_sales).toFixed(2),
        Number(d.daily_total).toFixed(2),
      ].join(',')
    ),
    '',
    `Month,${monthLabel}`,
    `Walk-in Total,${Number(data.walkin_total).toFixed(2)}`,
    `Delivery Total,${Number(data.delivery_total).toFixed(2)}`,
    `Grand Total,${Number(data.grand_total_sales).toFixed(2)}`,
  ];

  const fileUri = `${FileSystem.documentDirectory}PurefectMonthly_${monthLabel}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: `Monthly Report ${monthLabel}`,
    UTI: 'public.comma-separated-values-text',
  });
}

export async function exportMonthlyPDF(year: number, month: number): Promise<void> {
  const data = await api.get<MonthlySummary>(`/reports/monthly?year=${year}&month=${month}`);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long',
  });
  const monthLabel = `${year}-${String(month).padStart(2, '0')}`;

  const activeDays = data.days.filter(d => Number(d.daily_total) > 0);
  const rowsHtml = activeDays.length
    ? activeDays.map((d, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td>${new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
        <td style="text-align:right">&#8369;${Number(d.walkin_sales).toLocaleString()}</td>
        <td style="text-align:right">&#8369;${Number(d.delivery_sales).toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">&#8369;${Number(d.daily_total).toLocaleString()}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center;color:#999;padding:24px">No sales this month</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:28px;color:#1a1a1a;font-size:13px}
  .hdr{text-align:center;margin-bottom:24px}
  .hdr h1{color:#1D9E75;margin:0 0 4px;font-size:22px}
  .hdr p{color:#666;margin:0}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:#1D9E75;color:#fff;padding:9px 10px;text-align:left;font-size:12px}
  td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px}
  .grid{display:flex;flex-wrap:wrap;gap:10px}
  .card{flex:1;min-width:120px;background:#f8f8f8;border-radius:8px;padding:12px 14px}
  .card .lbl{font-size:11px;color:#888;margin-bottom:3px}
  .card .val{font-size:16px;font-weight:700;color:#1D9E75}
  .grand{background:#1D9E75;color:#fff;border-radius:10px;padding:16px;text-align:center;margin-top:14px}
  .grand .lbl{font-size:11px;opacity:.85;margin-bottom:2px}
  .grand .val{font-size:28px;font-weight:700}
</style>
</head><body>
<div class="hdr">
  <h1>Purefect Water Station</h1>
  <p>Monthly Sales Report &nbsp;&middot;&nbsp; ${monthName}</p>
</div>
<table>
  <thead><tr>
    <th>Date</th>
    <th style="text-align:right">Walk-in</th>
    <th style="text-align:right">Delivery</th>
    <th style="text-align:right">Total</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="grid">
  <div class="card"><div class="lbl">Walk-in Total</div><div class="val">&#8369;${Number(data.walkin_total).toLocaleString()}</div></div>
  <div class="card"><div class="lbl">Delivery Total</div><div class="val">&#8369;${Number(data.delivery_total).toLocaleString()}</div></div>
</div>
<div class="grand">
  <div class="lbl">MONTHLY TOTAL</div>
  <div class="val">&#8369;${Number(data.grand_total_sales).toLocaleString()}</div>
</div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const destUri = `${FileSystem.documentDirectory}PurefectMonthly_${monthLabel}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: destUri });
  await Sharing.shareAsync(destUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Monthly Report ${monthLabel}`,
    UTI: 'com.adobe.pdf',
  });
}
