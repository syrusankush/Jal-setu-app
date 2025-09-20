const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const User = require('../models/User');
const fs = require('fs');

// Upload document
router.post('/upload', auth, upload.single('document'), async (req, res) => {
  try {
    console.log('Upload request received:', req.file, req.body);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!req.body.title || !req.body.description || !req.body.gramPanchayatId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const document = new Document({
      title: req.body.title,
      description: req.body.description,
      fileUrl: req.file.filename,
      gramPanchayatId: req.body.gramPanchayatId,
      uploadedBy: req.user.id,
      documentType: req.body.documentType || 'OTHER'
    });

    await document.save();

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error in document upload:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get documents for a gram panchayat
router.get('/gram-panchayat/:gpId', auth, async (req, res) => {
  try {
    const documents = await Document.find({ gramPanchayatId: req.params.gpId })
      .populate('uploadedBy', 'name')
      .sort({ uploadedAt: -1 });

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, message: 'Error fetching documents' });
  }
});

// Download/View document
router.get('/view/:filename', auth, (req, res) => {
  try {
    const file = path.join(__dirname, '..', 'uploads', req.params.filename);
    
    // Get file extension
    const ext = path.extname(req.params.filename).toLowerCase();
    
    // Set content type based on file extension
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    }
    
    // Set proper headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline; filename=' + req.params.filename);
    
    // Check if file exists
    if (!fs.existsSync(file)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    // Stream the file
    const fileStream = fs.createReadStream(file);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      res.status(500).json({ success: false, message: 'Error accessing file' });
    });
  } catch (error) {
    console.error('Error in view document:', error);
    res.status(500).json({ success: false, message: 'Error accessing file' });
  }
});

// Update the gram-panchayat route with simpler document fetch
router.get('/gram-panchayat', auth, async (req, res) => {
  try {
    console.log('User making request:', req.user);

    // First get all gram panchayats associated with this PS
    const gramPanchayats = await User.find({
      'role': 'Grampanchayat',
      'associatedTo.userId': req.user._id
    }).select('_id');

    console.log('Found gram panchayats:', gramPanchayats);

    const gpIds = gramPanchayats.map(gp => gp._id);
    console.log('GP IDs:', gpIds);

    // Just get documents without populating gramPanchayatId
    const documents = await Document.find({
      gramPanchayatId: { $in: gpIds }
    })
      .populate('uploadedBy', 'name')
      .sort({ uploadedAt: -1 });

    console.log('Found documents:', documents);
    console.log(`Found ${documents.length} documents for PS ${req.user.uniqueId}`);

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching documents',
      error: error.message 
    });
  }
});

module.exports = router; 