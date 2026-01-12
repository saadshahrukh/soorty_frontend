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


// slip generation function - Optimized for BC-85AC thermal printer (80mm width)
export async function generateOrderSlip(order: Order) {
  // Thermal slip dimensions for BC-85AC
  const pageWidth = 80; // 80mm thermal paper
  const pageHeight = 3276; // Continuous roll paper
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight]
  });

  const leftMargin = 2;
  const rightMargin = 2;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 76mm usable width

  // Your Base64 Logo
  const logoBase64 = await convertImageToBase64('/logo.png');
  
  const centerText = (text: string, y: number) => {
    const textWidth = doc.getTextWidth(text);
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };

  let yPosition = 5;

  // LOGO - Top Center (scaled for 80mm paper)
  if (logoBase64) {
    try {
      const logoWidth = 25; // Reduced for 80mm paper
      const logoHeight = 12; // Reduced proportionally
      const logoX = (pageWidth - logoWidth) / 2;
      
      doc.addImage(logoBase64, 'PNG', logoX, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 2;
    } catch (error) {
      console.error('Logo Not Loaded:', error);
    }
  }

  // Header Text - Increased font size for readability
  doc.setFontSize(8);
  doc.setTextColor(0);
  centerText('03218286245 | 02133542016', yPosition);
  yPosition += 3.5;
  
  doc.setFontSize(7); // Slightly smaller for address
  centerText('Shop# 08 Euro Grand Park Nazimabad', yPosition);
  yPosition += 3.5;
  
  centerText('No 1, Karachi, Pakistan', yPosition);
  yPosition += 5;

  // Date and Bill No
  const currentDate = new Date();
  const formattedDate = `${currentDate.getDate().toString().padStart(2, '0')}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getFullYear()} ${currentDate.getHours()}:${currentDate.getMinutes().toString().padStart(2, '0')}${currentDate.getHours() >= 12 ? 'PM' : 'AM'}`;
  
  doc.setFontSize(7);
  doc.text(`Date: ${formattedDate}`, leftMargin, yPosition);
  yPosition += 4;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  centerText(`Bill No: ${order.orderId}`, yPosition);
  yPosition += 6;

  // Customer Information Table - Using a structured layout
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Details:', leftMargin, yPosition);
  yPosition += 4;

  // Create a bordered box for customer info
  const customerBoxTop = yPosition;
  const customerBoxHeight = 25; // Fixed height box
  
  // Draw customer info box
  doc.setDrawColor(0);
  doc.rect(leftMargin, customerBoxTop, contentWidth, customerBoxHeight);
  
  // Reset font for content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  
  let infoY = customerBoxTop + 4;
  
  // Name with automatic line break
  const custName = (order as any).customerSupplierName || 
                   (order as any).clientName || 
                   (order as any).customerName || 
                   ((order as any).customer && (order as any).customer.name) || 
                   'N/A';
  const nameLines = doc.splitTextToSize(`Name: ${custName}`, contentWidth - 4);
  doc.text(nameLines, leftMargin + 2, infoY);
  infoY += (nameLines.length * 3.5);
  
  // Phone
  const custPhone = (order as any).customerPhone || 
                    (order as any).clientPhone || 
                    (order as any).customerPhone || 
                    ((order as any).customer && (order as any).customer.phone) || 
                    '0340-XXXXXXX';
  const phoneLines = doc.splitTextToSize(`Phone: ${custPhone}`, contentWidth - 4);
  doc.text(phoneLines, leftMargin + 2, infoY);
  infoY += (phoneLines.length * 3.5);
  
  // Address with automatic line break
  const address = (order as any).customerAddress || 
                  (order as any).clientAddress || 
                  ((order as any).customer && (order as any).customer.address) || 
                  'Karachi, Pakistan';
  const addressLines = doc.splitTextToSize(`Address: ${address}`, contentWidth - 4);
  doc.text(addressLines, leftMargin + 2, infoY);
  infoY += (addressLines.length * 3.5);
  
  yPosition = customerBoxTop + customerBoxHeight + 3;

  // Line separator
  doc.setDrawColor(0);
  doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition);
  yPosition += 4;

  // Duplicate Bill text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  centerText('DUPLICATE BILL', yPosition);
  yPosition += 6;

  // PRODUCTS TABLE - Optimized for 80mm width
  const tableTop = yPosition;
  
  // Adjusted column widths for 76mm content width
  const colWidths = [28, 12, 10, 10, 16]; // Item(28), Price(12), Qty(10), Disc(10), Amount(16)
  const rowHeight = 6;
  const headerHeight = 5;

  // Table Header with Grey Background and Borders
  doc.setFillColor(240, 240, 240);
  doc.rect(leftMargin, tableTop, contentWidth, headerHeight, 'F');
  
  // Draw header borders
  doc.setDrawColor(0);
  doc.rect(leftMargin, tableTop, contentWidth, headerHeight);
  
  // Header text positions
  let currentX = leftMargin;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  
  // Draw column dividers and text
  const headers = ['Item', 'Price', 'Qty', 'Disc', 'Amount'];
  
  headers.forEach((header, index) => {
    doc.text(header, currentX + 2, tableTop + 3);
    if (index < headers.length - 1) {
      currentX += colWidths[index];
      doc.line(currentX, tableTop, currentX, tableTop + headerHeight);
    }
  });
  
  yPosition = tableTop + headerHeight;

  // Item Details - Optimized font size
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7); // Increased from 6 for better readability
  
  let totalSelling = 0;
  let totalCost = 0;
  let totalQty = 0;
  let totalDiscount = 0;

  const drawTableRow = (item: any, index: number) => {
    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(leftMargin, yPosition, contentWidth, rowHeight, 'F');
    }
    
    // Draw row border
    doc.setDrawColor(0);
    doc.rect(leftMargin, yPosition, contentWidth, rowHeight);
    
    // Draw vertical lines
    currentX = leftMargin;
    for (let i = 0; i < colWidths.length - 1; i++) {
      currentX += colWidths[i];
      doc.line(currentX, yPosition, currentX, yPosition + rowHeight);
    }
    
    // Get item data
    const productName = item.name || item.productServiceName || '';
    const sp = Number(item.sellingPrice || item.basePrice || 0);
    const qty = Number(item.quantity || 0);
    const discount = Number(item.discount || 0);
    const lineAmount = sp * qty;
    
    // Calculate vertical text position
    const textY = yPosition + (rowHeight / 2) - 1;
    
    // Item name with line breaks (max 2 lines)
    const productNameLines = doc.splitTextToSize(productName, colWidths[0] - 4);
    const displayLines = productNameLines.slice(0, 2); // Limit to 2 lines
    doc.text(displayLines, leftMargin + 2, textY);
    
    // Price (right aligned)
    const priceText = sp.toFixed(2);
    const priceWidth = doc.getTextWidth(priceText);
    doc.text(priceText, leftMargin + colWidths[0] + colWidths[1] - priceWidth - 2, textY);
    
    // Quantity (center aligned)
    const qtyText = String(qty);
    const qtyWidth = doc.getTextWidth(qtyText);
    doc.text(qtyText, leftMargin + colWidths[0] + colWidths[1] + (colWidths[2] / 2) - (qtyWidth / 2), textY);
    
    // Discount (right aligned)
    const discText = discount.toFixed(2);
    const discWidth = doc.getTextWidth(discText);
    doc.text(discText, leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - discWidth - 2, textY);
    
    // Amount (right aligned)
    const amountText = lineAmount.toFixed(2);
    const amountWidth = doc.getTextWidth(amountText);
    doc.text(amountText, leftMargin + contentWidth - amountWidth - 2, textY);
    
    // Adjust yPosition based on product name lines
    yPosition += rowHeight + (displayLines.length > 1 ? 2 : 0);
    
    return { lineAmount, qty, discount };
  };

  // Draw products
  if ((order as any).products && Array.isArray((order as any).products) && (order as any).products.length > 0) {
    (order as any).products.forEach((p: any, index: number) => {
      const result = drawTableRow(p, index);
      totalSelling += result.lineAmount;
      totalQty += result.qty;
      totalCost += Number(p.costPrice || p.baseCost || 0) * result.qty;
      totalDiscount += result.discount;
    });
  } else {
    const singleProduct = {
      name: order.productServiceName || (order as any).name || '',
      sellingPrice: order.sellingPrice || 0,
      quantity: order.quantity || 0,
      discount: (order as any).orderDiscount || 0
    };
    
    const result = drawTableRow(singleProduct, 0);
    totalSelling = result.lineAmount;
    totalQty = result.qty;
    totalCost = Number(order.costPrice || 0) * result.qty;
  }

  // Order-level discount
  totalDiscount += Number((order as any).orderDiscount || 0);
  
  // Line after items
  doc.setDrawColor(0);
  doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition);
  yPosition += 4;

  // Total Section - Right aligned
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  const delivery = Number((order as any).deliveryCharge || 0);
  const deliveryPaidByCustomer = (order as any).deliveryPaidByCustomer !== undefined ? 
    Boolean((order as any).deliveryPaidByCustomer) : true;
  const finalAmountFromOrder = Number((order as any).finalAmount || 0);
  const computedGrandTotal = finalAmountFromOrder || 
    (((totalSelling - totalDiscount) * (1 + ((order as any).taxPercent || 0)/100)) + 
     (deliveryPaidByCustomer ? delivery : 0));

  // Create two-column layout for totals
  const totals = [
    { label: 'Total Bill:', value: totalSelling.toFixed(2) },
    { label: 'Discount:', value: totalDiscount.toFixed(2) },
    { label: 'Delivery:', value: (deliveryPaidByCustomer ? delivery.toFixed(2) : '0.00') },
    { label: 'Grand Total:', value: computedGrandTotal.toFixed(2) },
  ];

  totals.forEach(item => {
    doc.text(item.label, leftMargin, yPosition);
    const valueX = pageWidth - rightMargin - doc.getTextWidth(item.value) - 2;
    doc.text(item.value, valueX, yPosition);
    yPosition += 4;
  });

  yPosition += 3;

  // Payment Details
  let amountPaid = 0;
  let balance = computedGrandTotal;
  const finalAmount = finalAmountFromOrder || computedGrandTotal;
  
  if (order.paymentStatus === 'Paid') {
    amountPaid = finalAmount;
    balance = 0;
  } else if (order.paymentStatus === 'Partial') {
    amountPaid = Number((order as any).partialPaidAmount || 0);
    balance = Number((order as any).partialRemainingAmount || Math.max(0, finalAmount - amountPaid));
  }

  doc.text('Amount Paid:', leftMargin, yPosition);
  const paidValueX = pageWidth - rightMargin - doc.getTextWidth(amountPaid.toFixed(2)) - 2;
  doc.text(amountPaid.toFixed(2), paidValueX, yPosition);
  yPosition += 4;

  doc.text('Balance:', leftMargin, yPosition);
  const balanceValueX = pageWidth - rightMargin - doc.getTextWidth(balance.toFixed(2)) - 2;
  doc.text(balance.toFixed(2), balanceValueX, yPosition);
  yPosition += 6;

  // Final line
  doc.setDrawColor(0);
  doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition);
  yPosition += 4;

  // Footer Section - Optimized for small paper
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  
  centerText('Thankyou For Shopping. Come Again.', yPosition);
  yPosition += 4;
  
  doc.setFontSize(6);
  centerText('No Return No Exchange Without Bill', yPosition);
  yPosition += 4;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  centerText('For Payment Details:', yPosition);
  yPosition += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  centerText('Meezan Bank', yPosition);
  yPosition += 3;
  centerText('Pak Soorty Dates', yPosition);
  yPosition += 3;
  centerText('Account No: 99 6201 0943 5654', yPosition);
  yPosition += 4;

  // Software info
  doc.setFontSize(5);
  centerText('Software Design By Metawayz', yPosition);
  yPosition += 2.5;
  centerText('www.metawayz.com | +923452208269', yPosition);

  // Save with proper name
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
      'Business','Order ID','Type','Product/Service','Qty','Cost','Selling','Profit','Status','Method','Customer/Supplier','Created'
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
      'Order ID','Type','Product/Service','Qty','Cost','Selling','Profit','Status','Method','Customer/Supplier','Created'
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

export function generateCustomerReport(params: { customer: any; orders: Order[]; summary: { sales:number; cost:number; profit:number; pending:number; orderCount:number }; period?: { start?: string; end?: string } }) {
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
    head: [[ 'Bill No', 'Date', 'Items', 'Qty', 'Amount', 'Paid', 'Balance' ]],
    body: orders.map(o => {
      const _o: any = o as any;
      const items = (_o.products && _o.products.length > 0) ? _o.products.map((p:any) => p.name).join(', ') : _o.productServiceName;
      const qty = String(_o.quantity || (_o.products ? _o.products.reduce((s:any,p:any)=>s+(p.quantity||0),0) : 0));
      const amount = Number(_o.finalAmount || 0).toFixed(2);
      const paid = _o.paymentStatus === 'Paid' ? Number(_o.finalAmount||0).toFixed(2) : (_o.paymentStatus==='Partial' ? Number(_o.partialPaidAmount||0).toFixed(2) : '0.00');
      const balance = Number(_o.partialRemainingAmount || (_o.paymentStatus==='Paid' ? 0 : _o.finalAmount || 0)).toFixed(2);
      return [ _o.orderId, new Date(_o.createdAt).toLocaleDateString(), items, qty, amount, paid, balance ];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59,130,246] }
  });

  const y = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 34;
  autoTable(doc, {
    startY: y,
    head: [['Metric','Value']],
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


