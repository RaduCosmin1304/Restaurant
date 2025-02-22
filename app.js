/******************************************************
 * app.js
 ******************************************************/
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

const PORT = 3000;
const mongoURI = 'mongodb://localhost:27017/RestaurantOrder'; 
// ^ Update this to match your MongoDB Compass connection string if needed.

// 1. Connect to MongoDB
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB using Mongoose'))
  .catch(err => console.error('MongoDB connection error:', err));

// 2. Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// 4. Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/******************************************************
 * USER MODEL & ROUTES (as in your original code)
 ******************************************************/
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
});

const User = mongoose.model('User', userSchema);

/**
 * CREATE: POST /users
 * Creates a new user from data submitted via an HTML form or API.
 */
app.post('/users', async (req, res) => {
  try {
    const newUser = new User({ name: req.body.name, email: req.body.email });
    const savedUser = await newUser.save();

    // Build a string that only includes the name and email without {}
    const userString = `"name": "${savedUser.name}",\n"email": "${savedUser.email}"`;

    // Return an HTML page with a textarea displaying the user info
    res.status(201).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>User Created</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            textarea {
              width: 100%;
              height: 300px;
              font-family: monospace;
              font-size: 14px;
              padding: 10px;
            }
            a {
              display: inline-block;
              margin-top: 20px;
            }
          </style>
      </head>
      <body>
          <h1>User Created Successfully</h1>
          <textarea readonly>${userString}</textarea>
          <br>
          <a href="/">Go back</a>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error</title>
      </head>
      <body>
          <h1>Error creating user</h1>
          <textarea readonly>${err.message}</textarea>
          <br>
          <a href="/">Go back</a>
      </body>
      </html>
    `);
  }
});

/**
 * READ ALL: GET /users
 * Retrieves all users.
 */
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * READ ONE: GET /users/:id
 * Retrieves a single user by ID.
 */
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * UPDATE: PUT /users/:id
 * Updates a user's name and email.
 */
app.put('/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name, email: req.body.email },
      { new: true }  // Return the updated document
    );
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE: DELETE /users/:id
 * Deletes a user by ID.
 */
app.delete('/users/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/******************************************************
 * ORDER MODEL & ROUTES
 ******************************************************/
const orderSchema = new mongoose.Schema({
  orderItems: [
    {
      productId: String,
      name: String,
      quantity: Number,
      price: Number
    }
  ],
  total: Number,
  paymentMethod: String,
  recension: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'order' }); 
// ^ This ensures the collection name is exactly "order" (not "orders").

const Order = mongoose.model('Order', orderSchema);

/**
 * CREATE ORDER: POST /orders
 * Saves a new order with order details.
 *
 * Modified to accept the keys sent by the client ("order" and "payment")
 * and to compute the total automatically.
 */
app.post('/orders', async (req, res) => {
  // Debug: Log the incoming request body
  console.log("POST /orders - request body:", req.body);

  // Destructure the keys from the client payload
  const { order, payment, recension } = req.body;

  // Compute total from the order array
  let total = 0;
  if (order && Array.isArray(order)) {
    total = order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Use 'order' as the orderItems
  const orderItems = order;

  // Validate required fields
  if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
    console.error("Validation Error: Order items are missing or invalid.", req.body);
    return res.status(400).json({ message: 'Order items are required.' });
  }
  if (typeof total !== 'number') {
    console.error("Validation Error: Total is not a valid number.", req.body);
    return res.status(400).json({ message: 'Valid total is required.' });
  }
  if (!payment || (payment !== 'cash' && payment !== 'card')) {
    console.error("Validation Error: Payment method is missing or invalid.", req.body);
    return res.status(400).json({ message: 'Payment method must be either cash or card.' });
  }

  try {
    const newOrder = new Order({
      orderItems,
      total,
      paymentMethod: payment,
      recension: recension || ''
    });

    const savedOrder = await newOrder.save();
    console.log("Order saved successfully:", savedOrder);
    res.status(201).json(savedOrder);
  } catch (err) {
    console.error("Error in POST /orders:", err);
    res.status(500).json({ error: err.message });
  }
});

// Optional: Add a GET /orders route for debugging purposes
app.get('/orders', async (req, res) => {
  console.log("GET /orders accessed.");
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (err) {
    console.error("Error in GET /orders:", err);
    res.status(500).json({ error: err.message });
  }
});

/******************************************************
 * START SERVER
 ******************************************************/
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
