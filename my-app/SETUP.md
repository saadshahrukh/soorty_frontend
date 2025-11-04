# Business Financial Dashboard - Setup Guide

A complete Next.js + Node.js dashboard for managing 3 businesses (Travel, Dates, Belts) with financial tracking, order management, and role-based access control.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- MongoDB running locally or MongoDB Atlas account
- npm or yarn

### Installation Steps

1. **Install dependencies**
   ```bash
   cd my-app
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file in the `my-app` directory:
   ```
   MONGODB_URI=mongodb://localhost:27017/business_dashboard
   JWT_SECRET=your-secret-key-change-this-in-production
   PORT=5000
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

3. **Start MongoDB**
   - If using local MongoDB:
     ```bash
     mongod
     ```
   - Or use MongoDB Atlas and update `MONGODB_URI` in `.env`

4. **Start the backend server**
   ```bash
   npm run server
   ```
   Server will run on `http://localhost:5000`

5. **Start the frontend** (in a new terminal)
   ```bash
   npm run dev
   ```
   App will run on `http://localhost:3000`

## 📝 First Time Setup

1. **Register an Admin Account**
   - Go to `http://localhost:3000/login`
   - Click "Register"
   - Enter your details with role "Admin"
   - Click Register

2. **Create Test Data**
   - Login with your admin account
   - Navigate to Orders page
   - Add sample orders for each business type

## 🎯 Features

### Authentication & Roles
- **Admin**: Full access to all features
- **Accountant**: View and manage financial data
- **Warehouse**: Create and update orders
- **Investor**: View-only with limited profit visibility (40% of actual profit)

### Dashboard Features
- Real-time financial summary
- Business-wise breakdown (Travel, Dates, Belts)
- Total sales, cost, profit, and pending payments
- Recent orders table
- Clean, modern UI

### Order Management
- Create, update, delete orders
- Filter by business type, payment status, date range
- Automatic profit calculation
- Payment tracking (Paid/Unpaid/Partial)
- Multiple payment methods (Cash, Bank, JazzCash, Online)

### Summary & Reporting
- Monthly summaries
- Custom date range reports
- Business-wise breakdowns
- Export capabilities (coming soon)

### Audit Trail
- Track all changes
- User activity logging
- Admin-only audit log view

## 📁 Project Structure

```
my-app/
├── api/
│   ├── models/         # MongoDB schemas (Order, User, AuditLog)
│   ├── routes/         # API endpoints (auth, orders, summary)
│   └── middleware/     # JWT auth & audit logging
├── src/
│   ├── app/            # Next.js pages
│   │   ├── dashboard/  # Main dashboard page
│   │   ├── orders/     # Order management
│   │   └── login/      # Authentication
│   ├── lib/            # API client
│   └── store/          # Zustand state management
├── server.js           # Express backend server
└── package.json        # Dependencies

```

## 🔧 Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TailwindCSS v4
- Zustand (State Management)
- Axios (API Client)
- Recharts (Charts - available)

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- BCrypt (Password hashing)

## 📊 API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Orders
- `GET /api/orders` - Get all orders (with filters)
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Summary
- `GET /api/summary/monthly` - Get monthly summary
- `GET /api/summary/range` - Get date range summary

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/audit-logs` - Get audit logs (Admin only)

## 🎨 Business Types

1. **Travel Agency** - Travel services and bookings
2. **Dates** - Date e-commerce + wholesale
3. **Belt Machines** - Belt manufacturing business

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Audit logging for all actions
- Protected API routes

## 🚧 Future Enhancements

- [ ] PDF/Excel export functionality
- [ ] Email reports
- [ ] Advanced charts and analytics
- [ ] Invoice generation
- [ ] Payment reminders
- [ ] Multi-currency support
- [ ] Real-time notifications

## 🐛 Troubleshooting

**MongoDB Connection Error**
- Ensure MongoDB is running
- Check MONGODB_URI in `.env`
- Try restarting MongoDB service

**Port Already in Use**
- Change PORT in `.env` or server.js
- Kill the process using the port

**Authentication Issues**
- Clear localStorage
- Check JWT_SECRET in `.env`

## 📞 Support

For issues or questions, please check the GitHub repository or create an issue.

---

**Built with ❤️ for efficient business financial management**

