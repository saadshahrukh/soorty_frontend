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

export async function generateOrderSlip(order: Order) {
  const pageWidth = 80; 
  const pageHeight = 3276; 
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight]
  });

  // Safe Margins: 3mm Left, 8mm Right to stop the cutting issue
  const leftMargin = 3;
  const rightMargin = 8; 
  const contentWidth = pageWidth - leftMargin - rightMargin;

  const centerText = (text: string, y: number) => {
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };

  const rightAlignText = (text: string, y: number) => {
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (leftMargin + contentWidth) - textWidth, y);
  };

  let yPosition = 6;

  // --- 1. BIGGER LOGO ---
  const logoBase64 = await convertImageToBase64('/logo.png');
  if (logoBase64) {
    try {
      const logoW = 38; 
      const logoH = 20;
      doc.addImage(logoBase64, 'PNG', (pageWidth - logoW) / 2, yPosition, logoW, logoH);
      yPosition += logoH + 4;
    } catch (e) {}
  }

  // --- 2. HEADER ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  centerText('03218286245 | 02133542016', yPosition);
  yPosition += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  centerText('Shop# 08 Euro Grand Park Nazimabad', yPosition);
  yPosition += 4;
  centerText('No 1, Karachi, Pakistan', yPosition);
  yPosition += 6;

  // --- 3. DATE & BILL NO ---
  const currentDate = new Date();
  const formattedDate = `${currentDate.getDate()}-${currentDate.getMonth() + 1}-${currentDate.getFullYear()} ${currentDate.getHours()}:${currentDate.getMinutes()}`;
  doc.setFontSize(8);
  doc.text(`Date: ${formattedDate}`, leftMargin, yPosition);
  yPosition += 5;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  centerText(`Bill No: ${order.orderId}`, yPosition);
  yPosition += 8;

  // --- 4. CUSTOMER DETAILS (Compact Version) ---
  doc.setFontSize(9);
  doc.text('Customer Details:', leftMargin, yPosition);
  yPosition += 2;

  const custName = (order as any).customerSupplierName || (order as any).clientName || (order as any).customerName || (order as any).customer?.name || 'Walk-in Customer';
  const custPhone = (order as any).customerPhone || (order as any).clientPhone || (order as any).customer?.phone || 'N/A';
  const custAddr = (order as any).customerAddress || (order as any).clientAddress || (order as any).customer?.address || 'Karachi';

  const drawCustRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const splitVal = doc.splitTextToSize(value, contentWidth - 22);
    const rowH = (splitVal.length * 4) + 2;
    
    doc.rect(leftMargin, yPosition, 20, rowH); // Label box
    doc.text(label, leftMargin + 2, yPosition + 4.5);
    
    doc.setFont('helvetica', 'normal');
    doc.rect(leftMargin + 20, yPosition, contentWidth - 20, rowH); // Value box
    doc.text(splitVal, leftMargin + 22, yPosition + 4.5);
    yPosition += rowH;
  };

  drawCustRow('Name:', custName);
  drawCustRow('Phone:', custPhone);
  drawCustRow('Address:', custAddr);

  // --- 5. SALE RECEIPT HEADER (Larger than customer section) ---
  yPosition += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  centerText('SALE RECIEPT', yPosition); 
  yPosition += 6;

  // --- 6. PRODUCTS TABLE (Dynamic Layout) ---
  const colWidths = [24, 12, 6, 9, 14];
  doc.setFillColor(240, 240, 240);
  doc.rect(leftMargin, yPosition, contentWidth, 7, 'F');
  doc.rect(leftMargin, yPosition, contentWidth, 7);
  
  doc.setFontSize(8.5);
  let curX = leftMargin;
  ['Item', 'Price', 'Qty', 'Disc', 'Amt'].forEach((h, i) => {
    doc.text(h, curX + 1.5, yPosition + 4.5);
    curX += colWidths[i];
    if (i < 4) doc.line(curX, yPosition, curX, yPosition + 7);
  });
  yPosition += 7;

  let totalSelling = 0;
  let totalItemDiscount = 0;
  const products = (order as any).products || [order];

  products.forEach((p: any) => {
    const sp = Number(p.sellingPrice || 0);
    const qty = Number(p.quantity || 1);
    const disc = Number(p.discount || 0);
    const lineAmt = sp * qty;
    
    totalSelling += lineAmt;
    totalItemDiscount += disc;

    const pName = doc.splitTextToSize(p.name || p.productServiceName || '', colWidths[0] - 2);
    const rowH = Math.max(7, pName.length * 4);
    
    doc.rect(leftMargin, yPosition, contentWidth, rowH);
    let rowX = leftMargin;
    doc.text(pName, rowX + 1, yPosition + 4.5); // Name
    rowX += colWidths[0];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(sp.toFixed(0), rowX + 1, yPosition + 4.5); // Price
    rowX += colWidths[1];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(String(qty), rowX + 1.5, yPosition + 4.5); // Qty
    rowX += colWidths[2];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(disc.toFixed(0), rowX + 1, yPosition + 4.5); // Disc
    rowX += colWidths[3];
    doc.line(rowX, yPosition, rowX, yPosition + rowH);
    doc.text(lineAmt.toFixed(0), rowX + 1, yPosition + 4.5); // Amt
    yPosition += rowH;
  });

  // --- 7. TOTALS SECTION (With DC and Discounts) ---
  yPosition += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  const orderDiscount = Number((order as any).orderDiscount || 0);
  const delivery = Number((order as any).deliveryCharge || 0);
  const totalDiscount = totalItemDiscount + orderDiscount;
  const grandTotal = Number((order as any).finalAmount || (totalSelling - totalDiscount + delivery));

  const drawTotalLine = (label: string, value: string) => {
    doc.text(label, leftMargin, yPosition);
    rightAlignText(value, yPosition);
    yPosition += 5.5;
  };

  drawTotalLine('Total Bill:', totalSelling.toFixed(2));
  if (totalDiscount > 0) drawTotalLine('Discount:', totalDiscount.toFixed(2));
  if (delivery > 0) drawTotalLine('Delivery (DC):', delivery.toFixed(2));
  
  doc.line(leftMargin, yPosition - 1, leftMargin + contentWidth, yPosition - 1);
  yPosition += 2;
  doc.setFontSize(11);
  drawTotalLine('Grand Total:', grandTotal.toFixed(2));

  // --- 8. PAYMENT STATUS ---
  let paid = 0;
  if (order.paymentStatus === 'Paid') paid = grandTotal;
  else if (order.paymentStatus === 'Partial') paid = Number((order as any).partialPaidAmount || 0);
  const balance = Math.max(0, grandTotal - paid);

  doc.setFontSize(10);
  drawTotalLine('Amount Paid:', paid.toFixed(2));
  doc.setFontSize(11);
  drawTotalLine('Balance:', balance.toFixed(2));

  // --- 9. FOOTER ---
  yPosition += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  centerText('Thankyou For Shopping. Come Again.', yPosition);
  yPosition += 4;
  centerText('No Return No Exchange Without Bill', yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  centerText('Meezan Bank | Pak Soorty Dates', yPosition);
  yPosition += 4.5;
  centerText('Account No: 99 6201 0943 5654', yPosition);

  doc.save(`SALE_RECIEPT_${order.orderId}.pdf`);
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


