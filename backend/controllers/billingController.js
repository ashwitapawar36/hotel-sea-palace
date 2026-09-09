const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../config/db');
const { uploadDir } = require('../config/env');

function buildBillNumber() {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// PDFKit's standard 14 fonts (Helvetica etc.) don't carry the Indian Rupee
// glyph, so "Rs." is used instead of "₹" everywhere in the PDF - printing a
// missing-glyph box would look broken, not "basic". The rest of the app
// (Cart, DigitalBill, etc.) is plain HTML/CSS, which renders "₹" fine, so
// only the PDF path needs this workaround.
function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

// --- PDF design constants -------------------------------------------------
const GOLD = '#B8860B';
const GOLD_DARK = '#8a6508';
const INK = '#1f2430';
const MUTED = '#6b7280';
const BORDER = '#d9d2c0';
const PANEL = '#faf6ec';

const PAGE_MARGIN = 42;
const COL = {
  item: { x: PAGE_MARGIN, width: 255 },
  qty: { x: PAGE_MARGIN + 255, width: 45 },
  unit: { x: PAGE_MARGIN + 300, width: 95 },
  amount: { x: PAGE_MARGIN + 395, width: 78 },
};
const TABLE_RIGHT_EDGE = COL.amount.x + COL.amount.width;

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function drawGoldRule(doc, y) {
  doc.save();
  doc.moveTo(PAGE_MARGIN, y).lineTo(TABLE_RIGHT_EDGE, y).lineWidth(1.4).strokeColor(GOLD).stroke();
  doc.restore();
}

function ensureSpace(doc, currentY, needed, onNewPage) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (currentY + needed > bottomLimit) {
    doc.addPage();
    return onNewPage ? onNewPage() : doc.page.margins.top;
  }
  return currentY;
}

function drawHeader(doc, restaurantName) {
  let y = doc.page.margins.top;
  doc.fillColor(GOLD_DARK).font('Helvetica-Bold').fontSize(24).text(restaurantName, PAGE_MARGIN, y, {
    width: TABLE_RIGHT_EDGE - PAGE_MARGIN,
    align: 'center',
  });
  y = doc.y + 2;
  doc.fillColor(INK).font('Helvetica').fontSize(10.5).text('Professional Restaurant Invoice', PAGE_MARGIN, y, {
    width: TABLE_RIGHT_EDGE - PAGE_MARGIN,
    align: 'center',
  });
  y = doc.y + 3;
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(
    'Near Post Office, Beach Road, Alibaug  |  +91 74983 40889 / +91 79775 24615',
    PAGE_MARGIN,
    y,
    { width: TABLE_RIGHT_EDGE - PAGE_MARGIN, align: 'center' },
  );
  y = doc.y + 10;
  drawGoldRule(doc, y);
  return y + 16;
}

// Two-column label/value grid for invoice metadata - every value here comes
// from the actual order row, never hardcoded (invoice number, table, order
// id, date/time are all read off `order` / `billNumber` by the caller).
function drawMetaGrid(doc, y, rows) {
  const colWidth = (TABLE_RIGHT_EDGE - PAGE_MARGIN) / 2;
  const rowHeight = 30;
  rows.forEach((pair, rowIndex) => {
    pair.forEach((field, colIndex) => {
      if (!field) return;
      const x = PAGE_MARGIN + colIndex * colWidth;
      const rowY = y + rowIndex * rowHeight;
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(field.label.toUpperCase(), x, rowY, { width: colWidth - 10, characterSpacing: 0.4 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(field.value, x, rowY + 12, { width: colWidth - 10 });
    });
  });
  return y + rows.length * rowHeight + 8;
}

function drawTableHeader(doc, y) {
  const headerHeight = 22;
  doc.rect(PAGE_MARGIN, y, TABLE_RIGHT_EDGE - PAGE_MARGIN, headerHeight).fill(GOLD);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  doc.text('ITEM', COL.item.x + 8, y + 7, { width: COL.item.width - 8 });
  doc.text('QTY', COL.qty.x, y + 7, { width: COL.qty.width, align: 'center' });
  doc.text('UNIT PRICE', COL.unit.x, y + 7, { width: COL.unit.width - 6, align: 'right' });
  doc.text('AMOUNT', COL.amount.x, y + 7, { width: COL.amount.width - 8, align: 'right' });
  return y + headerHeight;
}

// Renders every order line, wrapping long dish names onto multiple lines
// (e.g. "Chicken Afagan Tandoori (Full)") without overlapping the row below
// or cutting text off, and starting a fresh page - with the header repeated
// - whenever a row would run past the bottom margin.
function drawItemRows(doc, startY, items) {
  let y = drawTableHeader(doc, startY);
  doc.font('Helvetica').fontSize(9.5).fillColor(INK);

  items.forEach((item, index) => {
    const label = item.variant_label ? `${item.name} (${item.variant_label})` : item.name;
    const nameHeight = doc.heightOfString(label, { width: COL.item.width - 8 });
    const rowHeight = Math.max(20, nameHeight + 10);

    y = ensureSpace(doc, y, rowHeight + 4, () => drawTableHeader(doc, doc.page.margins.top));

    if (index % 2 === 1) {
      doc.save();
      doc.rect(PAGE_MARGIN, y, TABLE_RIGHT_EDGE - PAGE_MARGIN, rowHeight).fill(PANEL);
      doc.restore();
    }

    doc.fillColor(INK).font('Helvetica').fontSize(9.5);
    doc.text(label, COL.item.x + 8, y + 6, { width: COL.item.width - 8 });
    doc.text(String(item.quantity), COL.qty.x, y + 6, { width: COL.qty.width, align: 'center' });
    doc.text(formatCurrency(item.unit_price), COL.unit.x, y + 6, { width: COL.unit.width - 6, align: 'right' });
    doc.text(formatCurrency(item.line_total), COL.amount.x, y + 6, { width: COL.amount.width - 8, align: 'right' });

    y += rowHeight;
    doc.save();
    doc.moveTo(PAGE_MARGIN, y).lineTo(TABLE_RIGHT_EDGE, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.restore();
  });

  return y + 10;
}

// Subtotal / tax breakdown - rows with a zero amount are skipped entirely
// (e.g. no "VAT: Rs. 0.00" line on an alcohol-free order), matching the same
// rule the Digital Bill screen uses.
function drawTotals(doc, startY, order) {
  const rows = [];
  if (Number(order.food_subtotal) > 0) rows.push(['Food / Non-Alcoholic Subtotal', formatCurrency(order.food_subtotal)]);
  if (Number(order.cgst_amount) > 0) rows.push(['CGST (9%)', formatCurrency(order.cgst_amount)]);
  if (Number(order.sgst_amount) > 0) rows.push(['SGST (9%)', formatCurrency(order.sgst_amount)]);
  if (Number(order.alcohol_subtotal) > 0) rows.push(['Alcohol Subtotal', formatCurrency(order.alcohol_subtotal)]);
  if (Number(order.vat_amount) > 0) rows.push(['VAT (10%)', formatCurrency(order.vat_amount)]);

  const boxWidth = 260;
  const boxX = TABLE_RIGHT_EDGE - boxWidth;
  const rowHeight = 18;
  const grandRowHeight = 30;
  const totalHeight = rows.length * rowHeight + grandRowHeight + 14;

  let y = ensureSpace(doc, startY, totalHeight + 10);

  rows.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(label, boxX, y, { width: boxWidth - 90 });
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(value, boxX + boxWidth - 90, y, { width: 90, align: 'right' });
    y += rowHeight;
  });

  y += 6;
  doc.save();
  doc.rect(boxX, y, boxWidth, grandRowHeight).fill(GOLD);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12.5);
  doc.text('GRAND TOTAL', boxX + 12, y + 9, { width: boxWidth - 100 - 12 });
  doc.text(formatCurrency(order.total_amount), boxX + boxWidth - 100, y + 9, { width: 88, align: 'right' });
  doc.restore();

  return y + grandRowHeight + 20;
}

function drawPaymentStatus(doc, startY, order) {
  const y = ensureSpace(doc, startY, 26);
  const isPaid = order.payment_status === 'paid';
  const statusText = isPaid
    ? `PAYMENT STATUS: PAID${order.payment_method ? ` VIA ${String(order.payment_method).toUpperCase()}` : ''}`
    : 'PAYMENT STATUS: AWAITING PAYMENT';
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(isPaid ? '#1a7d3a' : GOLD_DARK);
  doc.text(statusText, PAGE_MARGIN, y, { width: TABLE_RIGHT_EDGE - PAGE_MARGIN });
  return doc.y + 16;
}

// Flows right after the payment-status line rather than being pinned to the
// physical bottom of the page - anchoring it to the page bottom left a huge
// empty gap on any normal (short) order, which the design brief explicitly
// calls out to avoid. It still never collides with the totals/table above
// it, and a genuinely long, multi-page order still gets it directly under
// its own last line of content.
function drawFooter(doc, startY) {
  const y = ensureSpace(doc, startY, 44);
  doc.save();
  doc.moveTo(PAGE_MARGIN, y).lineTo(TABLE_RIGHT_EDGE, y).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.fillColor(GOLD_DARK).font('Helvetica-Bold').fontSize(10).text('Thank you for dining with us!', PAGE_MARGIN, y + 10, {
    width: TABLE_RIGHT_EDGE - PAGE_MARGIN,
    align: 'center',
  });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('Hotel Sea Palace', PAGE_MARGIN, y + 26, {
    width: TABLE_RIGHT_EDGE - PAGE_MARGIN,
    align: 'center',
  });
  doc.restore();
}

// Every value drawn onto the page comes from `order`, `billNumber`, or
// `items` - nothing here is hardcoded (invoice number, table, order id,
// dishes, quantities, prices, totals, taxes, payment status all flow
// straight from the database row the caller looked up).
function renderInvoicePdf(doc, { restaurantName, billNumber, tableNumber, order, items }) {
  let y = drawHeader(doc, restaurantName);

  y = drawMetaGrid(doc, y, [
    [
      { label: 'Invoice No.', value: billNumber },
      { label: 'Table No.', value: tableNumber ? `Table ${tableNumber}` : 'N/A' },
    ],
    [
      { label: 'Date', value: formatDate(order.created_at) },
      { label: 'Order ID', value: order.order_number },
    ],
    [
      { label: 'Time', value: formatTime(order.created_at) },
      { label: 'Customer', value: order.customer_name || 'Guest' },
    ],
  ]);
  drawGoldRule(doc, y);
  y += 14;

  y = drawItemRows(doc, y, items);
  y = drawTotals(doc, y, order);
  y = drawPaymentStatus(doc, y, order);
  drawFooter(doc, y);
}

// Generating the invoice PDF is a separate concept from actually paying it -
// this only ever creates the bill/PDF and never touches orders.payment_status
// or sets paid_at. See orderController.payOrder for the step that records a
// completed payment. It's also idempotent: calling this twice for the same
// order returns the bill that already exists (bills.order_id is UNIQUE)
// instead of erroring or generating a second PDF.
async function createBill(req, res, next) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { orderId, restaurantName = 'Hotel Sea Palace' } = req.body;

    if (!orderId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const { rows: orderRows } = await client.query(
      `SELECT o.id, o.order_number, o.customer_name, o.subtotal, o.tax_amount, o.food_subtotal, o.alcohol_subtotal,
              o.cgst_amount, o.sgst_amount, o.vat_amount, o.total_amount, o.payment_status, o.payment_method,
              o.table_id, o.created_at, rt.table_number
       FROM orders o
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       WHERE o.id = $1`,
      [orderId],
    );

    if (!orderRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderRows[0];

    const { rows: existingBill } = await client.query('SELECT id, bill_number, total_amount, created_at FROM bills WHERE order_id = $1', [orderId]);
    if (existingBill[0]) {
      await client.query('COMMIT');
      return res.status(200).json({ success: true, data: { bill: existingBill[0], downloadUrl: `/uploads/${existingBill[0].bill_number}.pdf` } });
    }

    const { rows: itemRows } = await client.query(
      `SELECT oi.quantity, oi.unit_price, oi.line_total, mi.name, mv.label AS variant_label
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [order.id],
    );

    const billNumber = buildBillNumber();
    // Same directory-creation step upload.js already does for menu images -
    // this must exist before the write stream opens, or a fresh deployment
    // (no uploads/ yet) fails to write the PDF at all.
    const uploadsPath = path.join(__dirname, '..', uploadDir);
    fs.mkdirSync(uploadsPath, { recursive: true });
    const billPath = path.join(uploadsPath, `${billNumber}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    renderInvoicePdf(doc, { restaurantName, billNumber, tableNumber: order.table_number, order, items: itemRows });

    // The response (and the `bills` row) must not go out until the PDF is
    // actually sitting on disk - piping and immediately responding raced
    // the write, so a quick download right after checkout could 404 even
    // when everything above "worked".
    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(billPath);
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.pipe(stream);
      doc.end();
    });

    const { rows: billRows } = await client.query(
      `INSERT INTO bills (order_id, bill_number, subtotal, tax_amount, food_subtotal, alcohol_subtotal, cgst_amount, sgst_amount, vat_amount, discount_amount, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, bill_number, total_amount, created_at`,
      [order.id, billNumber, order.subtotal, order.tax_amount, order.food_subtotal, order.alcohol_subtotal, order.cgst_amount, order.sgst_amount, order.vat_amount, 0, order.total_amount],
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { bill: billRows[0], downloadUrl: `/uploads/${billNumber}.pdf` } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

async function getBill(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT id, order_id, bill_number, subtotal, tax_amount, food_subtotal, alcohol_subtotal, cgst_amount, sgst_amount, vat_amount, total_amount, payment_method, paid_at, created_at
       FROM bills WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
}

module.exports = { createBill, getBill };
