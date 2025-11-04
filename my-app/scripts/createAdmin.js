/*
  One-time script to create an Admin user.
  Usage: set MONGODB_URI and JWT_SECRET in my-app/.env, then run:
    npm run create-admin
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const User = require('../api/models/User');

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set. Please create my-app/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const name = process.env.SEED_ADMIN_NAME || 'Admin User';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const role = process.env.SEED_ROLE || 'Admin';

  let user = await User.findOne({ email });
  if (user) {
    console.log(`Admin already exists: ${email}`);
  } else {
    user = new User({ name, email, password, role });
    await user.save();
    console.log(`${role} created: ${email}`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


