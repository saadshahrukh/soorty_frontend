# API Routing Fix - Complete Endpoint Mapping

## Problem Found & Fixed

The root API handler (`/api/[...slug].js`) was not correctly routing dynamic paths and named exports. This caused:
- `/stock/product/{id}` to fail - missing parameter handling
- `/expenses/totals` missing entirely
- `/warehouses/{id}` routing issues with DELETE, PUT, GET
- `/orders/{id}` and `/products/{id}` not handling all HTTP methods properly

## Fixed Endpoints

### Authentication
```
POST   /auth/login        → auth/login.js (default export)
POST   /auth/register     → auth/register.js (default export)  
GET    /auth/me           → auth/me.js (default export)
```

### Orders
```
GET    /orders            → orders/index.js (GET handler)
POST   /orders            → orders/index.js (POST handler)
GET    /orders/search     → orders/search.js
POST   /orders/bulk       → orders/bulk.js
GET    /orders/{id}       → orders/[id].js (GET handler)
PUT    /orders/{id}       → orders/[id].js (PUT handler)
DELETE /orders/{id}       → orders/[id].js (DELETE handler)
```

### Products
```
GET    /products          → products/index.js (GET handler)
POST   /products          → products/index.js (POST handler)
GET    /products/{id}     → products/[id].js (GET handler)
PUT    /products/{id}     → products/[id].js (PUT handler)
DELETE /products/{id}     → products/[id].js (DELETE handler)
```

### Stock
```
GET    /stock/transfers        → stock/transfers.js
GET    /stock/transfer         → stock/transfer.js
GET    /stock/product/{id}     → stock/product.js .get() function
POST   /stock/product/{id}/allocate   → stock/product.js .allocate() function
PUT    /stock/product/{id}/allocation → stock/product.js .adjust() function
POST   /stock/transfer         → stock/transfer.js
```

### Warehouses
```
GET    /warehouses        → warehouses/index.js (GET handler)
POST   /warehouses        → warehouses/index.js (POST handler)
GET    /warehouses/{id}   → warehouses/[id].js
PUT    /warehouses/{id}   → warehouses/update.js
DELETE /warehouses/{id}   → warehouses/delete.js
```

### Customers
```
GET    /customers         → customers/index.js
```

### Expenses
```
GET    /expenses          → expenses/index.js
POST   /expenses          → expenses/index.js
GET    /expenses/totals   → expenses/totals.js (NEW - was missing!)
```

### Summary
```
GET    /summary/monthly   → summary/monthly.js
GET    /summary/range     → summary/range.js
```

### Users
```
GET    /users             → users/index.js
POST   /users/register    → users/index.js
GET    /users/me          → users/me.js
GET    /users/audit-logs  → users/audit-logs.js
POST   /users/password    → users/password.js
PUT    /users/update      → users/update.js
```

### Internal
```
GET    /internal/logs     → internal/logs.js
POST   /internal/import-shopify-latest → internal/import-shopify-latest.js
```

## Key Fixes

1. **Dynamic Path Parameters**: slug[2] = resourceId, slug[3] = action
   - `/stock/product/ID` → uses resourceId as productId
   - `/stock/product/ID/allocate` → uses action parameter

2. **Named Exports Handling**: Some endpoints export multiple functions
   - `stock/product.js` exports `.get()`, `.allocate()`, `.adjust()`
   - Route based on HTTP method + action parameter

3. **Missing Endpoint**: Created `/expenses/totals` endpoint
   - Was being called by ledger page but didn't exist
   - Now calculates expense totals by business type

4. **HTTP Method Routing**: Proper GET/POST/PUT/DELETE routing
   - `/warehouses` POST handled by index.js
   - `/orders/{id}` DELETE handled by [id].js
   - `/products` POST handled by index.js

## No Business Logic Changed

✅ All original backend logic preserved
✅ Only routing/delegation was fixed
✅ All API implementations remain unchanged
✅ Same database models, calculations, and functionality
