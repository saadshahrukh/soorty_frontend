import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Order } from '@/store/orderStore';

// @/lib/utils.ts mein ye function add karo
export const convertImageToBase64 = async (imagePath: string): Promise<string> => {
  try {
    const response = await fetch(imagePath);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Logo Not loaded:', error);
    return '';
  }
};


// slip generation function - Fixed for BC-85AC (80mm paper, 72mm printable area)
export async function generateOrderSlip(order: Order) {
  // Use 76mm width to match the reference software's perfect scaling
  const pageWidth = 76;
  const pageHeight = 3276; // Continuous roll
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight]
  });

  // Margins: 4mm on each side leaves 68mm for content (very safe for 80mm paper)
  const leftMargin = 4;
  const rightMargin = 4;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  const centerText = (text: string, y: number) => {
    const textWidth = doc.getTextWidth(text);
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };

  const rightAlignText = (text: string, y: number) => {
    const textWidth = doc.getTextWidth(text);
    const x = pageWidth - rightMargin - textWidth;
    doc.text(text, x, y);
  };

  let yPosition = 6;

  // --- LOGO ---
  const logoBase64 = await convertImageToBase64('/logo.png');
  if (logoBase64) {
    try {
      const logoWidth = 30; // Slightly larger logo
      const logoHeight = 15;
      doc.addImage(logoBase64, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 3;
    } catch (e) { }
  }

  // --- HEADER (Increased Font Size) ---
  doc.setFontSize(10); // Larger header
  doc.setFont('helvetica', 'bold');
  centerText('03218286245 | 02133542016', yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  centerText('Shop# 08 Euro Grand Park Nazimabad', yPosition);
  yPosition += 4.5;
  centerText('No 1, Karachi, Pakistan', yPosition);
  yPosition += 7;

  // --- DATE & BILL NO ---
  const currentDate = new Date();
  const formattedDate = `${currentDate.getDate()}-${currentDate.getMonth() + 1}-${currentDate.getFullYear()} ${currentDate.getHours()}:${currentDate.getMinutes()}`;

  doc.setFontSize(9);
  doc.text(`Date: ${formattedDate}`, leftMargin, yPosition);
  yPosition += 5;

  doc.setFontSize(12); // Large Bill No
  doc.setFont('helvetica', 'bold');
  centerText(`Bill No: ${order.orderId}`, yPosition);
  yPosition += 7;

  // --- CUSTOMER DETAILS TABLE (Properly Bordered) ---
  doc.setFontSize(9);
  doc.text('Customer Details:', leftMargin, yPosition);
  yPosition += 2;

  // FIX: Robust Name Mapping
  const custName = (order as any).customerName ||
    (order as any).customer?.name ||
    (order as any).clientName ||
    (order as any).customerSupplierName ||
    "Walk-in Customer";

  const drawInfoBox = (label: string, value: string, height: number) => {
    doc.setFont('helvetica', 'bold');
    doc.rect(leftMargin, yPosition, 20, height);
    doc.text(label, leftMargin + 2, yPosition + (height / 2) + 1);

    doc.setFont('helvetica', 'normal');
    doc.rect(leftMargin + 20, yPosition, contentWidth - 20, height);
    const wrappedValue = doc.splitTextToSize(value || 'N/A', contentWidth - 24);
    doc.text(wrappedValue, leftMargin + 22, yPosition + 4);
    yPosition += height;
  };

  drawInfoBox('Name:', custName, 8);
  drawInfoBox('Phone:', (order as any).customerPhone || (order as any).customer?.phone || 'N/A', 8);

  const addr = (order as any).customerAddress || (order as any).customer?.address || 'N/A';
  const addrLines = doc.splitTextToSize(addr, contentWidth - 24);
  const addrBoxHeight = Math.max(8, addrLines.length * 4.5);
  drawInfoBox('Address:', addr, addrBoxHeight);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  centerText('DUPLICATE BILL', yPosition);
  yPosition += 6;

  // --- PRODUCT TABLE (Increased Item Column) ---
  // Layout: Item(26), Price(11), Qty(7), Disc(10), Amount(14) = 68mm
  const colWidths = [26, 11, 7, 10, 14];
  doc.setFillColor(230, 230, 230);
  doc.rect(leftMargin, yPosition, contentWidth, 7, 'F');
  doc.rect(leftMargin, yPosition, contentWidth, 7);

  doc.setFontSize(8);
  let curX = leftMargin;
  ['Item', 'Price', 'Qty', 'Disc', 'Amt'].forEach((h, i) => {
    doc.text(h, curX + 1, yPosition + 4.5);
    curX += colWidths[i];
    if (i < 4) doc.line(curX, yPosition, curX, yPosition + 7);
  });
  yPosition += 7;

  // --- ITEMS LOOP ---
  doc.setFont('helvetica', 'normal');
  const products = (order as any).products || [order];

  products.forEach((p: any) => {
    const lineAmt = (p.sellingPrice || 0) * (p.quantity || 1);
    const pName = doc.splitTextToSize(p.name || p.productServiceName || '', colWidths[0] - 2);
    const rowH = Math.max(7, pName.length * 4);

    doc.rect(leftMargin, yPosition, contentWidth, rowH);
    let rowX = leftMargin;

    doc.text(pName, rowX + 1, yPosition + 4); // Product Name
    rowX += colWidths[0];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(Number(p.sellingPrice).toFixed(0), rowX + 1, yPosition + 4.5); // Price

    rowX += colWidths[1];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(String(p.quantity), rowX + 1.5, yPosition + 4.5); // Qty

    rowX += colWidths[2];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(Number(p.discount || 0).toFixed(0), rowX + 1, yPosition + 4.5); // Disc

    rowX += colWidths[3];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(lineAmt.toFixed(0), rowX + 1, yPosition + 4.5); // Total

    yPosition += rowH;
  });

  // --- TOTALS SECTION (Large and Bold) ---
  yPosition += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  const finalAmt = Number((order as any).finalAmount || (order as any).totalSelling);
  const paid = order.paymentStatus === 'Paid' ? finalAmt : Number((order as any).partialPaidAmount || 0);
  const balance = Math.max(0, finalAmt - paid);

  const drawTotalLine = (label: string, value: string, size = 10) => {
    doc.setFontSize(size);
    doc.text(label, leftMargin, yPosition);
    rightAlignText(value, yPosition);
    yPosition += 6;
  };

  drawTotalLine('Total Bill:', finalAmt.toFixed(2));
  doc.line(leftMargin, yPosition - 1, leftMargin + contentWidth, yPosition - 1);
  yPosition += 2;

  drawTotalLine('Amount Paid:', paid.toFixed(2));
  doc.setFontSize(11); // Make balance slightly bigger
  drawTotalLine('Balance:', balance.toFixed(2));

  // --- FOOTER ---
  yPosition += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  centerText('Thankyou For Shopping. Come Again.', yPosition);
  yPosition += 4.5;
  centerText('No Return No Exchange Without Bill', yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  centerText('Meezan Bank | Pak Soorty Dates', yPosition);
  yPosition += 4.5;
  centerText('A/C: 99 6201 0943 5654', yPosition);

  // Auto-Save/Print
  doc.save(`SLIP_${order.orderId}.pdf`);
}

export function generateOrdersReport(orders: Order[], title = 'Orders Report') {
  const doc = new jsPDF('l');
  doc.setFontSize(16);
  doc.text(title, 14, 14);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);

  autoTable(doc, {
    startY: 26,
    head: [[
      'Business', 'Order ID', 'Type', 'Product/Service', 'Qty', 'Cost', 'Selling', 'Profit', 'Status', 'Method', 'Customer/Supplier', 'Created'
    ]],
    body: orders.map(o => [
      o.businessType,
      o.orderId,
      o.orderType,
      o.productServiceName,
      String(o.quantity),
      String(o.costPrice),
      String(o.sellingPrice),
      String(o.profit),
      o.paymentStatus,
      o.paymentMethod,
      o.customerSupplierName,
      new Date(o.createdAt).toLocaleDateString(),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [99, 102, 241] },
  });

  doc.save('orders_report.pdf');
}

export function generateBusinessReport(params: {
  business: 'Travel' | 'Dates' | 'Belts';
  orders: Order[];
  summary: { sales: number; cost: number; profit: number; pending: number; orderCount: number };
}) {
  const { business, orders, summary } = params;
  const doc = new jsPDF('l');
  doc.setFontSize(18);
  doc.text(`${business} - Business Report`, 14, 14);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);

  autoTable(doc, {
    startY: 26,
    head: [['Metric', 'Value']],
    body: [
      ['Sales', String(summary.sales)],
      ['Cost', String(summary.cost)],
      ['Profit', String(summary.profit)],
      ['Pending', String(summary.pending)],
      ['Orders', String(summary.orderCount)],
    ],
    styles: { fontSize: 10 },
    theme: 'grid',
    headStyles: { fillColor: [20, 184, 166] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [[
      'Order ID', 'Type', 'Product/Service', 'Qty', 'Cost', 'Selling', 'Profit', 'Status', 'Method', 'Customer/Supplier', 'Created'
    ]],
    body: orders.map(o => [
      o.orderId,
      o.orderType,
      o.productServiceName,
      String(o.quantity),
      String(o.costPrice),
      String(o.sellingPrice),
      String(o.profit),
      o.paymentStatus,
      o.paymentMethod,
      o.customerSupplierName,
      new Date(o.createdAt).toLocaleDateString(),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`${business.toLowerCase()}_report.pdf`);
}

export function generateCustomerReport(params: { customer: any; orders: Order[]; summary: { sales: number; cost: number; profit: number; pending: number; orderCount: number }; period?: { start?: string; end?: string } }) {
  const { customer, orders, summary, period } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(16);
  doc.text(`Customer Report - ${customer.name || ''}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`Phone: ${customer.phone || ''}`, 14, 22);
  if (period && (period.start || period.end)) {
    doc.text(`Period: ${period.start || '-'} to ${period.end || '-'}`, 14, 28);
  }

  autoTable(doc, {
    startY: 34,
    head: [['Bill No', 'Date', 'Items', 'Qty', 'Amount', 'Paid', 'Balance']],
    body: orders.map(o => {
      const _o: any = o as any;
      const items = (_o.products && _o.products.length > 0) ? _o.products.map((p: any) => p.name).join(', ') : _o.productServiceName;
      const qty = String(_o.quantity || (_o.products ? _o.products.reduce((s: any, p: any) => s + (p.quantity || 0), 0) : 0));
      const amount = Number(_o.finalAmount || 0).toFixed(2);
      const paid = _o.paymentStatus === 'Paid' ? Number(_o.finalAmount || 0).toFixed(2) : (_o.paymentStatus === 'Partial' ? Number(_o.partialPaidAmount || 0).toFixed(2) : '0.00');
      const balance = Number(_o.partialRemainingAmount || (_o.paymentStatus === 'Paid' ? 0 : _o.finalAmount || 0)).toFixed(2);
      return [_o.orderId, new Date(_o.createdAt).toLocaleDateString(), items, qty, amount, paid, balance];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  const y = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 34;
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Sales', String(summary.sales.toFixed(2))],
      ['Cost', String(summary.cost.toFixed(2))],
      ['Profit', String(summary.profit.toFixed(2))],
      ['Pending', String(summary.pending.toFixed(2))],
      ['Orders', String(summary.orderCount)],
    ],
    theme: 'grid',
    styles: { fontSize: 10 }
  });

  doc.save(`CUSTOMER_${customer.name || customer.phone || 'report'}.pdf`);
}


