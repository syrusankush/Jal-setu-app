const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const PDFDocument = require('pdfkit');
// Old credentials
const MERCHANT_ID = "PGTESTPAYUAT86";
const SALT_KEY = "96434309-7796-489d-8924-ab56988a6076";
const SALT_INDEX = 1;

// Test route to check if payment routes are working
router.get('/test', (req, res) => {
    res.json({ message: 'Payment routes are working' });
});

// Get all transactions
router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        // Filter transactions by the authenticated user's ID
        const transactions = await Transaction.find({ 
            userId: req.user._id 
        }).sort({ paymentDate: -1 });
        
        // If there's a pending transaction, check if it's already been paid
        const pendingTransaction = transactions.find(t => t.status === 'PENDING');
        if (pendingTransaction) {
            const isAlreadyPaid = transactions.some(t => 
                t.status === 'SUCCESS' && 
                t.amount === pendingTransaction.amount && 
                t.purpose === pendingTransaction.purpose &&
                t.paymentDate > pendingTransaction.paymentDate
            );
            
            // If the transaction is already paid, update its status
            if (isAlreadyPaid) {
                await Transaction.findByIdAndUpdate(
                    pendingTransaction._id,
                    { status: 'SUCCESS' }
                );
                
                // Refresh the transactions list for this user
                const updatedTransactions = await Transaction.find({ 
                    userId: req.user._id 
                }).sort({ paymentDate: -1 });
                return res.json({ success: true, transactions: updatedTransactions });
            }
        }
        
        res.json({ success: true, transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Initiate payment
router.post('/initiate', async (req, res) => {
    try {
        console.log('Received payment request:', req.body);
        
        // Check if there's already a pending transaction with the same amount and purpose
        const existingPendingTransaction = await Transaction.findOne({
            amount: req.body.amount,
            purpose: req.body.purpose,
            status: 'PENDING'
        });

        // Find user by uniqueId (merchantUserId)
        const user = await User.findOne({ uniqueId: req.body.merchantUserId });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // If a pending transaction exists, use that instead of creating a new one
        const merchantTransactionId = existingPendingTransaction 
            ? existingPendingTransaction.merchantTransactionId 
            : `MT${Date.now()}`;

        const requestBody = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: req.body.merchantUserId,
            amount: req.body.amount,
            redirectUrl: "https://webhook.site/redirect-url",
            redirectMode: "REDIRECT",
            callbackUrl: "https://webhook.site/callback-url",
            mobileNumber: req.body.mobileNumber || "9999999999",
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        // Only create a new transaction if one doesn't exist
        if (!existingPendingTransaction) {
            const transaction = new Transaction({
                userId: user._id, // Use the actual user's MongoDB _id
                merchantTransactionId: merchantTransactionId,
                amount: req.body.amount,
                purpose: req.body.purpose || "Water Bill Payment",
                status: 'PENDING'
            });

            await transaction.save();
            console.log('Transaction saved:', transaction);
        }

        const base64Payload = Buffer.from(JSON.stringify(requestBody)).toString('base64');
        const checksum = crypto
            .createHash('sha256')
            .update(base64Payload + "/pg/v1/pay" + SALT_KEY)
            .digest('hex') + '###' + SALT_INDEX;

        console.log('Making PhonePe request...');
        const response = await fetch('https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': MERCHANT_ID
            },
            body: JSON.stringify({
                request: base64Payload
            })
        });

        if (!response.ok) {
            throw new Error(`PhonePe API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('PhonePe response:', data);

        res.json({
            success: true,
            data: {
                ...data,
                transactionId: existingPendingTransaction?._id || transaction._id
            }
        });
    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to initiate payment'
        });
    }
});

// Callback route for PhonePe
router.post('/callback', async (req, res) => {
    try {
        const { merchantTransactionId, code } = req.body;
        const status = code === 'PAYMENT_SUCCESS' ? 'SUCCESS' : 'FAILED';
        
        await Transaction.findOneAndUpdate(
            { merchantTransactionId },
            { status }
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add this new route after your existing routes
router.post('/update-status', async (req, res) => {
  try {
    // Find the most recent PENDING transaction
    const pendingTransaction = await Transaction.findOne({ 
      status: 'PENDING' 
    }).sort({ paymentDate: -1 });

    if (!pendingTransaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'No pending transaction found' 
      });
    }

    // Update the transaction status
    pendingTransaction.status = req.body.status;
    await pendingTransaction.save();

    res.json({ 
      success: true, 
      message: 'Transaction status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update transaction status' 
    });
  }
});

// Add new pending payment (Bill generation by Grampanchayat)
router.post('/add-pending', authMiddleware, async (req, res) => {
    try {
        const gramPanchayat = req.user;
        
        if (!gramPanchayat || gramPanchayat.role !== 'Grampanchayat') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only Grampanchayat can generate bills.'
            });
        }

        const { userId, amount, dueDate, billType, billPeriod } = req.body;

        // Find the user by uniqueId
        const user = await User.findOne({ uniqueId: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate bill number
        const billNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create new transaction using billType as purpose
        const transaction = new Transaction({
            userId: user._id,
            generatedBy: {
                userId: gramPanchayat._id,
                uniqueId: gramPanchayat.uniqueId,
                role: 'Grampanchayat'
            },
            merchantTransactionId: `MT${Date.now()}`,
            billNumber,
            amount,
            status: 'PENDING',
            purpose: billType, // Use billType as purpose
            dueDate: new Date(dueDate),
            billType,
            billPeriod
        });

        await transaction.save();

        res.json({
            success: true,
            message: 'Bill generated successfully',
            transaction: {
                billNumber: transaction.billNumber,
                amount: transaction.amount,
                dueDate: transaction.dueDate,
                billType: transaction.billType
            }
        });

    } catch (error) {
        console.error('Error generating bill:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate bill'
        });
    }
});

// Get consumer list with their payment history
router.get('/consumers', authMiddleware, async (req, res) => {
    try {
        const gramPanchayat = req.user;
        
        if (!gramPanchayat || gramPanchayat.role !== 'Grampanchayat') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only Grampanchayat can access consumer list.'
            });
        }

        // Find all users (consumers) associated with this Grampanchayat
        const consumers = await User.find({
            'associatedTo.userId': gramPanchayat._id,
            'role': 'User'
        });

        // Get transactions for each consumer
        const consumersWithTransactions = await Promise.all(consumers.map(async (consumer) => {
            const transactions = await Transaction.find({
                userId: consumer._id
            }).sort({ paymentDate: -1 });

            const totalPaid = transactions
                .filter(t => t.status === 'SUCCESS')
                .reduce((sum, t) => sum + t.amount, 0);

            const pendingAmount = transactions
                .filter(t => t.status === 'PENDING')
                .reduce((sum, t) => sum + t.amount, 0);

            return {
                consumerId: consumer.uniqueId,
                transactions: transactions.map(t => ({
                    _id: t._id,
                    billNumber: t.billNumber,
                    amount: t.amount,
                    status: t.status,
                    purpose: t.billType, // Use billType instead of purpose
                    paymentDate: t.paymentDate,
                    dueDate: t.dueDate
                })),
                totalPaid,
                pendingAmount
            };
        }));

        res.json({
            success: true,
            consumers: consumersWithTransactions
        });

    } catch (error) {
        console.error('Error fetching consumers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch consumer list'
        });
    }
});

// Get cash book for Grampanchayat
router.get('/cash-book', authMiddleware, async (req, res) => {
    try {
        const gramPanchayat = req.user;

        if (!gramPanchayat || gramPanchayat.role !== 'Grampanchayat') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only Grampanchayat can access cash book.'
            });
        }

        // Get all transactions for this Grampanchayat
        const transactions = await Transaction.find({
            'generatedBy.userId': gramPanchayat._id
        })
        .populate('userId', 'uniqueId')
        .sort({ paymentDate: -1 });

        // Calculate statistics
        const stats = {
            totalBillsGenerated: transactions.filter(t => t.transactionType === 'CREDIT').length,
            totalAmountCollected: transactions
                .filter(t => t.status === 'SUCCESS' && t.transactionType === 'CREDIT')
                .reduce((sum, t) => sum + t.amount, 0),
            totalExpenses: transactions
                .filter(t => t.status === 'SUCCESS' && t.transactionType === 'DEBIT')
                .reduce((sum, t) => sum + t.amount, 0),
            pendingAmount: transactions
                .filter(t => t.status === 'PENDING' && t.transactionType === 'CREDIT')
                .reduce((sum, t) => sum + t.amount, 0),
            netBalance: transactions
                .filter(t => t.status === 'SUCCESS')
                .reduce((sum, t) => {
                    if (t.transactionType === 'CREDIT') {
                        return sum + t.amount;
                    } else {
                        return sum - t.amount;
                    }
                }, 0)
        };

        // Format transactions for response
        const formattedTransactions = transactions.map(t => ({
            _id: t._id,
            billNumber: t.billNumber,
            userId: t.userId?.uniqueId,
            amount: t.amount,
            status: t.status,
            purpose: t.purpose,
            paymentDate: t.paymentDate,
            dueDate: t.dueDate,
            transactionType: t.transactionType,
            inventoryExpense: t.inventoryExpense
        }));

        res.json({
            success: true,
            stats,
            transactions: formattedTransactions
        });

    } catch (error) {
        console.error('Error fetching cash book:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cash book'
        });
    }
});

// Add this new route for receipt download
router.get('/receipt/:transactionId', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId)
      .populate('userId', 'uniqueId name');
    
    if (!transaction || transaction.status !== 'SUCCESS') {
      return res.status(404).json({ success: false, message: 'Receipt not available' });
    }

    // Create PDF document
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${transaction.billNumber}.pdf`);
    
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Bill Number: ${transaction.billNumber}`);
    doc.text(`Consumer ID: ${transaction.userId.uniqueId}`);
    doc.text(`Amount Paid: ₹${transaction.amount/100}`);
    doc.text(`Payment Date: ${new Date(transaction.paymentDate).toLocaleDateString()}`);
    doc.text(`Purpose: ${transaction.purpose}`);
    doc.text(`Status: ${transaction.status}`);
    
    doc.end();
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ success: false, message: 'Failed to generate receipt' });
  }
});

// Add this new route after your existing routes
router.post('/add-pending-all', authMiddleware, async (req, res) => {
    try {
        const gramPanchayat = req.user;
        
        if (!gramPanchayat || gramPanchayat.role !== 'Grampanchayat') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only Grampanchayat can generate bills.'
            });
        }

        const { amount, dueDate, billType, billPeriod } = req.body;

        // Find all users associated with this Grampanchayat
        const users = await User.find({
            'associatedTo.userId': gramPanchayat._id,
            'role': 'User'
        });

        const generatedBills = [];

        // Generate bills for each user
        for (const user of users) {
            const billNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            const transaction = new Transaction({
                userId: user._id,
                generatedBy: {
                    userId: gramPanchayat._id,
                    uniqueId: gramPanchayat.uniqueId,
                    role: 'Grampanchayat'
                },
                merchantTransactionId: `MT${Date.now()}-${user._id}`,
                billNumber,
                amount,
                status: 'PENDING',
                purpose: billType,
                dueDate: new Date(dueDate),
                billType,
                billPeriod
            });

            await transaction.save();
            generatedBills.push(transaction);
        }

        res.json({
            success: true,
            message: 'Bills generated successfully for all users',
            generatedCount: generatedBills.length,
            bills: generatedBills.map(bill => ({
                billNumber: bill.billNumber,
                amount: bill.amount,
                dueDate: bill.dueDate,
                billType: bill.billType
            }))
        });

    } catch (error) {
        console.error('Error generating bills:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate bills'
        });
    }
});

module.exports = router; 
