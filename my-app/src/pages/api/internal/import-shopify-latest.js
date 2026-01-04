const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const axios = require('axios');
const Customer = require('../../../api/models/Customer');
const Order = require('../../../api/models/Order');

async function requestWithRetry(config, retries = 1, delayMs = 500) {
  try {
    return await axios(config);
  } catch (err) {
    if (retries > 0 && (!err.response || err.code === 'ECONNABORTED')) {
      await new Promise(r => setTimeout(r, delayMs));
      return requestWithRetry(config, retries - 1, delayMs);
    }
    throw err;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
    const API_VER = process.env.SHOPIFY_API_VERSION || '2024-01';
    if (!SHOP_DOMAIN || !ADMIN_TOKEN) return res.status(500).json({ status: 'error', message: 'Shopify credentials not configured on server' });

    const url = `https://${SHOP_DOMAIN}/admin/api/${API_VER}/orders.json?limit=1&status=any&order=created_at+desc`;
    const resp = await requestWithRetry({ method: 'GET', url, headers: { 'X-Shopify-Access-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' }, timeout: 5000 });
    const orders = resp.data && resp.data.orders ? resp.data.orders : [];
    if (!orders || orders.length === 0) return res.json({ status: 'no-orders', message: 'No orders found' });

    const shopOrder = orders[0];
    const externalOrderId = String(shopOrder.id);
    const createdAt = shopOrder.created_at;
    const totalPrice = shopOrder.current_total_price || shopOrder.total_price || '0.00';
    const phone = shopOrder.customer?.phone || shopOrder.billing_address?.phone || shopOrder.shipping_address?.phone || null;
    const email = shopOrder.customer?.email || shopOrder.email || null;
    let name = 'Unknown';
    if (shopOrder.customer && (shopOrder.customer.first_name || shopOrder.customer.last_name)) {
      name = `${shopOrder.customer.first_name || ''} ${shopOrder.customer.last_name || ''}`.trim();
    } else if (shopOrder.billing_address?.name) {
      name = shopOrder.billing_address.name;
    } else if (shopOrder.shipping_address?.name) {
      name = shopOrder.shipping_address.name;
    }
    const items = Array.isArray(shopOrder.line_items) ? shopOrder.line_items.map(li => ({ title: li.title, sku: li.sku || null, quantity: li.quantity || 1, price: li.price || '0.00' })) : [];

    const synthPhone = phone || (`shopify-${externalOrderId}`);
    let customer = await Customer.findOne({ $or: [ { phone: synthPhone }, { email: email } ] });
    if (!customer) {
      customer = await Customer.create({ name: name || 'Unknown', phone: synthPhone, address: shopOrder.billing_address?.address1 || '', email: email || '' });
    } else {
      let changed = false;
      if (!customer.name && name) { customer.name = name; changed = true; }
      if (!customer.email && email) { customer.email = email; changed = true; }
      if (!customer.address && shopOrder.billing_address?.address1) { customer.address = shopOrder.billing_address.address1; changed = true; }
      if (changed) await customer.save();
    }

    const orderKey = `shopify-${externalOrderId}`;
    const existing = await Order.findOne({ orderId: orderKey });
    const orderPayload = {
      orderId: orderKey,
      orderType: 'Shopify',
      businessType: 'Dates',
      productServiceName: items.map(i => i.title).join(', ') || 'Shopify Order',
      quantity: 1,
      sellingPrice: Number(totalPrice) || 0,
      costPrice: 0,
      paymentMethod: 'Online',
      createdAt: createdAt ? new Date(createdAt) : undefined,
      taxPercent: 0,
      deliveryCharge: 0,
      deliveryPaidByCustomer: true,
      customerSupplierName: name || 'Unknown',
      customerId: customer._id,
      customerPhone: synthPhone,
      customerAddress: shopOrder.shipping_address?.address1 || shopOrder.billing_address?.address1 || '',
      orderDiscount: 0,
      remarks: 'Imported from Shopify',
      userId: user._id,
      rawShopify: shopOrder
    };

    let orderDoc;
    if (existing) {
      orderDoc = await Order.findByIdAndUpdate(existing._id, orderPayload, { new: true });
      await orderDoc.save();
    } else {
      orderDoc = new Order(orderPayload);
      await orderDoc.save();
    }

    const out = { status: 'ok', action: existing ? 'updated' : 'created', order: orderDoc.toObject(), customer: customer.toObject() };
    res._jsonBody = out;
    return res.json(out);
  } catch (error) {
    console.error('Import Shopify Error:', error);
    return res.status(500).json({ status: 'error', message: error.message || String(error) });
  }
};
