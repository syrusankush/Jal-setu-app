const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const districtAdminRoutes = require('./routes/districtAdminRoutes');
const panchayatSamitiRoutes = require('./routes/panchayatSamitiRoutes');
const grampanchayatRoutes = require('./routes/grampanchayatRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const inventoryRoutes = require('./routes/inventoryRoute');
const fs = require('fs');
const path = require('path');

const app = express();

// Update CORS options
const corsOptions = {
  origin: ['http://localhost:3000', 'http://192.168.10.40:5000','http://192.168.101.12:5000','http://10.140.65.102:5501', 'http://10.140.64.230:5501', 'exp://192.168.10.40:19000', 'http://192.168.10.40:5501', 'exp://10.140.64.231:8081', 'http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:5501', 'http://192.168.187.12:5000', 'exp://192.168.187.12:8081', 'http://10.140.64.231:5501'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'Content-Type'],
};

app.use(cors(corsOptions));  // Apply CORS middleware with the updated options

// Connect to the database
connectDB();

// Middleware
app.use(express.json());  // To parse JSON bodies

// Use routes for different roles
app.use('/api/districtAdmin', districtAdminRoutes);
app.use('/api/panchayatSamiti', panchayatSamitiRoutes);
app.use('/api/grampanchayat', grampanchayatRoutes);
app.use('/api/user', userRoutes);
app.use('/api', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/assigned-work', require('./routes/assignedWorkRoutes'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/inventory-requests', require('./routes/inventoryRoute'));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

// Add this after the middleware section
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request body:', req.body);
  next();
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
