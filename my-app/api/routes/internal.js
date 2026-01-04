const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

// Helper: simple axios request with one retry on network failure
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

// POST /internal/import-shopify-latest
// Protected route: requires auth
router.post('/import-shopify-latest', auth, async (req, res) => {
  try {
    const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
    const API_VER = process.env.SHOPIFY_API_VERSION || '2024-01';

    if (!SHOP_DOMAIN || !ADMIN_TOKEN) {
      return res.status(500).json({ status: 'error', message: 'Shopify credentials not configured on server' });
    }

    const url = `https://${SHOP_DOMAIN}/admin/api/${API_VER}/orders.json?limit=1&status=any&order=created_at+desc`;
    const resp = await requestWithRetry({
      method: 'GET',
      url,
      headers: {
        'X-Shopify-Access-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    const orders = resp.data && resp.data.orders ? resp.data.orders : [];
    if (!orders || orders.length === 0) {
      return res.json({ status: 'no-orders', message: 'No orders found' });
    }

    const shopOrder = orders[0];
    const externalOrderId = String(shopOrder.id);
    const createdAt = shopOrder.created_at;
    const totalPrice = shopOrder.current_total_price || shopOrder.total_price || '0.00';
    const currency = shopOrder.currency || shopOrder.currency_iso_code || 'PKR';

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

    const items = Array.isArray(shopOrder.line_items) ? shopOrder.line_items.map(li => ({
      title: li.title,
      sku: li.sku || null,
      quantity: li.quantity || 1,
      price: li.price || '0.00'
    })) : [];

    // Upsert customer: prefer phone, then email, otherwise create synthetic phone
    const synthPhone = phone || (`shopify-${externalOrderId}`);
    let customer = await Customer.findOne({ $or: [ { phone: synthPhone }, { email: email } ] });
    if (!customer) {
      customer = await Customer.create({ name: name || 'Unknown', phone: synthPhone, address: shopOrder.billing_address?.address1 || '', email: email || '' });
    } else {
      // update missing fields
      let changed = false;
      if (!customer.name && name) { customer.name = name; changed = true; }
      if (!customer.email && email) { customer.email = email; changed = true; }
      if (!customer.address && shopOrder.billing_address?.address1) { customer.address = shopOrder.billing_address.address1; changed = true; }
      if (changed) await customer.save();
    }

    // Upsert order by external id (store as orderId with shopify- prefix to avoid clashes)
    const orderKey = `shopify-${externalOrderId}`;
    const existing = await Order.findOne({ orderId: orderKey });

    // Map to our Order schema minimal fields (legacy single-product fallback)
    const orderPayload = {
      orderId: orderKey,
      orderType: 'Shopify',
      businessType: 'Dates', // default to Dates to satisfy enum
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
      userId: req.user._id,
      rawShopify: shopOrder
    };

    // If order exists -> update, otherwise create
    let orderDoc;
    if (existing) {
      orderDoc = await Order.findByIdAndUpdate(existing._id, orderPayload, { new: true });
      await orderDoc.save();
    } else {
      // create
      orderDoc = new Order(orderPayload);
      await orderDoc.save();
    }

    return res.json({ status: 'ok', action: existing ? 'updated' : 'created', order: orderDoc.toObject(), customer: customer.toObject() });
  } catch (error) {
    // attempt to log error to internal route (best-effort)
    try {
      console.error('Import Shopify Error:', error);
      // if possible, persist to simple console or AuditLog later
    } catch (e) {}
    return res.status(500).json({ status: 'error', message: error.message || String(error) });
  }
});

// POST /internal/logs - basic endpoint to receive logs from clients (protected)
router.post('/logs', auth, async (req, res) => {
  try {
    const { level, message, stack, raw } = req.body || {};
    console[level === 'error' ? 'error' : 'log']('Client log:', { level, message, stack, raw, user: req.user && { id: req.user._id, name: req.user.name } });
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to record log', e);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
