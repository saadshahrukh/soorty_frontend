# Business Financial Dashboard

A complete financial management system for managing 3 businesses with Next.js, Node.js, MongoDB, and modern UI.

## 🎯 Overview

This system helps you consolidate financial records from WhatsApp and manual tracking into a single, automated dashboard showing:

- **Month-end breakdowns** by business (Travel, Dates, Belts)
- **Spending, sales, and profits** tracking
- **Pending payments** monitoring
- **Order management** with full CRUD operations
- **Role-based access** (Admin, Accountant, Warehouse, Investor)

## 🚀 Quick Start

See [SETUP.md](./SETUP.md) for detailed installation instructions.

### Quick Commands

```bash
# Install dependencies
npm install

# Start backend server (Terminal 1)
npm run server

# Start frontend dev server (Terminal 2)
npm run dev
```

Then open http://localhost:3000

## 📋 Features

### ✅ Completed
- [x] Authentication system (JWT)
- [x] Role-based access control
- [x] Order management (CRUD)
- [x] Dashboard with financial summary
- [x] Business-wise breakdown
- [x] Payment status tracking
- [x] Investor view (40% profit visibility)
- [x] Audit logging
- [x] Modern, responsive UI

### 🔄 In Progress
- [ ] PDF/Excel export
- [ ] Advanced charts
- [ ] Email reports

## 🏢 Business Types

1. **Travel Agency** - Travel services
2. **Dates** - E-commerce + Wholesale
3. **Belt Machines** - Belt manufacturing

## 🔐 User Roles

- **Admin**: Full access
- **Accountant**: Financial management
- **Warehouse**: Order creation/editing
- **Investor**: View-only (limited profit view)

## 📊 Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS 4
- **Backend**: Node.js, Express, MongoDB
- **State**: Zustand
- **Auth**: JWT

## 📁 Project Structure

```
my-app/
├── api/
│   ├── models/         # Mongoose schemas
│   ├── routes/         # API endpoints
│   └── middleware/     # Auth & audit
├── src/
│   ├── app/            # Pages
│   ├── lib/            # API client
│   └── store/          # State management
└── server.js           # Express server

```

## 🎨 Screenshots

*Dashboard view with financial cards, business breakdown, and recent orders table.*

## 📝 License

MIT

## 🤝 Contributing

This is a private project for client use.

---

**Need help?** Check [SETUP.md](./SETUP.md) or open an issue.
