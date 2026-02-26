const LicensingItem = require('../models/LicensingItem');

// ===== Licensing Item Endpoints =====
// @desc    Get all licensing items
// @route   GET /api/licensing-items
// @access  Public
exports.getAllItems = async (req, res) => {
  try {
    const items = await LicensingItem.findAll();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'שגיאת שרת בקבלת פריטי רישוי', error: error.message });
  }
};

// @desc    Get licensing item by identifier
// @route   GET /api/licensing-items/:id
// @access  Public
exports.getItemById = async (req, res) => {
  try {
    const item = await LicensingItem.findByPk(req.params.id);
    if (item) {
      res.json(item);
    } else {
      res.status(404).json({ message: 'פריט רישוי לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};

// @desc    Create new licensing item
// @route   POST /api/licensing-items
// @access  Private (Manager/Admin)
exports.createItem = async (req, res) => {
  try {
    // Insert new licensing item record.
    const newItem = await LicensingItem.create(req.body);
    
    res.status(201).json({
      message: 'פריט רישוי נוצר בהצלחה',
      item: newItem
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(400).json({ message: 'שגיאה ביצירת פריט רישוי', error: error.message });
  }
};

// @desc    Update existing licensing item
// @route   PUT /api/licensing-items/:id
// @access  Private (Manager/Admin)
exports.updateItem = async (req, res) => {
  try {
    const item = await LicensingItem.findByPk(req.params.id);

    if (item) {
      // Apply partial update from request payload.
      await item.update(req.body);
      res.json({
        message: 'פריט רישוי עודכן בהצלחה',
        item: item
      });
    } else {
      res.status(404).json({ message: 'פריט רישוי לא נמצא' });
    }
  } catch (error) {
    res.status(400).json({ message: 'שגיאה בעדכון פריט רישוי', error: error.message });
  }
};

// @desc    Delete licensing item
// @route   DELETE /api/licensing-items/:id
// @access  Private (Admin)
exports.deleteItem = async (req, res) => {
  try {
    const item = await LicensingItem.findByPk(req.params.id);

    if (item) {
      await item.destroy();
      res.json({ message: 'פריט רישוי נמחק בהצלחה' });
    } else {
      res.status(404).json({ message: 'פריט רישוי לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת במחיקת פריט', error: error.message });
  }
};