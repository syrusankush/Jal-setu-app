const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    generatedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        uniqueId: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['Grampanchayat'],
            required: true
        }
    },
    merchantTransactionId: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED'],
        default: 'PENDING'
    },
    purpose: {
        type: String,
        required: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: function() {
            return this.transactionType === 'CREDIT';
        }
    },
    billNumber: {
        type: String,
        required: true,
        unique: true
    },
    billType: {
        type: String,
        enum: ['Water Bill', 'Maintenance Bill', 'Other'],
        required: true
    },
    billPeriod: {
        from: Date,
        to: Date
    },
    transactionType: {
        type: String,
        enum: ['CREDIT', 'DEBIT'],
        required: true,
        default: 'CREDIT'
    },
    inventoryExpense: {
        isInventoryUsed: {
            type: Boolean,
            default: false
        },
        complaintId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Complaint'
        },
        items: [{
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Inventory'
            },
            itemName: String,
            quantity: Number,
            unit: String,
            cost: Number
        }],
        totalCost: {
            type: Number,
            default: 0
        }
    }
});

module.exports = mongoose.model('Transaction', transactionSchema); 