import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Order } from '../types';

export async function shareOrderReceipt(order: Order): Promise<void> {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const payColor = order.payment_type === 'CASH' ? '#15803D'
    : order.payment_type === 'GCASH' ? '#6D28D9' : '#B91C1C';
  const typeEmoji = order.order_type === 'WALK-IN' ? '🚶' : '🏍️';
  const receiptNo = order.receipt_no ?? `ORD-${order.order_id}`;

  const customerRow = order.customer
    ? `<tr><td class="key">Customer</td><td class="val">${order.customer.customer_name}</td></tr>`
    : '';
  const phoneRow = order.customer?.phone_number
    ? `<tr><td class="key">Phone</td><td class="val">${order.customer.phone_number}</td></tr>`
    : '';
  const addressRow = order.customer?.address
    ? `<tr><td class="key">Address</td><td class="val">${order.customer.address}</td></tr>`
    : '';
  const riderRow = (order as any).rider_name
    ? `<tr><td class="key">Rider</td><td class="val">${(order as any).rider_name}</td></tr>`
    : '';
  const gcashRefRow = order.gcash_ref
    ? `<tr><td class="key">GCash Ref</td><td class="val" style="color:#6D28D9;font-weight:700">${order.gcash_ref}</td></tr>`
    : '';
  const remarksRow = order.remarks
    ? `<tr><td class="key">Note</td><td class="val" style="font-style:italic">${order.remarks}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    max-width: 340px;
    margin: 0 auto;
    padding: 28px 20px;
    color: #1a1a1a;
    background: #fff;
  }
  .header {
    text-align: center;
    padding-bottom: 18px;
    border-bottom: 2px dashed #ddd;
    margin-bottom: 18px;
  }
  .store-name {
    font-size: 22px;
    font-weight: 800;
    color: #1D9E75;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
  }
  .store-sub { font-size: 12px; color: #888; }
  .receipt-no {
    display: inline-block;
    background: #f0fdf4;
    color: #15803D;
    font-size: 13px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid #bbf7d0;
    margin-top: 10px;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .key { font-size: 12px; color: #888; padding: 4px 0; width: 80px; }
  .val { font-size: 13px; font-weight: 600; color: #1a1a1a; padding: 4px 0; text-align: right; }
  .divider { border: none; border-top: 1px dashed #ddd; margin: 14px 0; }
  .items-box {
    background: #f9fafb;
    border-radius: 10px;
    padding: 14px;
    margin: 14px 0;
    border: 1px solid #e5e7eb;
  }
  .item-row {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: #374151;
    margin-bottom: 8px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid #d1d5db;
    font-size: 18px;
    font-weight: 800;
    color: #1D9E75;
  }
  .type-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    background: ${order.order_type === 'WALK-IN' ? '#DBEAFE' : '#FEF3C7'};
    color: ${order.order_type === 'WALK-IN' ? '#1D4ED8' : '#B45309'};
    margin-bottom: 4px;
  }
  .pay-badge {
    display: inline-block;
    padding: 6px 18px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    background: ${payColor};
    letter-spacing: 0.5px;
  }
  .footer {
    text-align: center;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 2px dashed #ddd;
    color: #aaa;
    font-size: 11px;
    line-height: 1.8;
  }
  .footer strong { color: #1D9E75; font-size: 12px; }
</style>
</head><body>

<div class="header">
  <div class="store-name">💧 Purefect Water Station</div>
  <div class="store-sub">Official Receipt</div>
  <div class="receipt-no"># ${receiptNo}</div>
</div>

<table>
  <tr><td class="key">Date</td><td class="val">${dateStr}</td></tr>
  <tr><td class="key">Time</td><td class="val">${timeStr}</td></tr>
  ${customerRow}
  ${phoneRow}
  ${addressRow}
  ${riderRow}
</table>

<div class="items-box">
  <div class="item-row">
    <span>${typeEmoji} ${order.quantity} gallon${Number(order.quantity) !== 1 ? 's' : ''}</span>
    <span>₱${Number(order.unit_price).toFixed(2)} / gal</span>
  </div>
  <div class="total-row">
    <span>TOTAL</span>
    <span>₱${Number(order.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
  </div>
</div>

<div style="text-align:center; margin-bottom: 12px;">
  <span class="type-badge">${typeEmoji} ${order.order_type}</span>
</div>
<div style="text-align:center; margin-bottom: 14px;">
  <span class="pay-badge">${order.payment_type}</span>
</div>

${(gcashRefRow || remarksRow) ? `<table>${gcashRefRow}${remarksRow}</table>` : ''}

<div class="footer">
  <strong>Thank you for your purchase!</strong><br/>
  Purefect Water Station<br/>
  Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
</div>

</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const safeName = receiptNo.toString().replace(/[^a-zA-Z0-9-]/g, '_');
  const dest = `${FileSystem.documentDirectory}Receipt_${safeName}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, {
    mimeType: 'application/pdf',
    dialogTitle: `Receipt ${receiptNo}`,
    UTI: 'com.adobe.pdf',
  });
}
