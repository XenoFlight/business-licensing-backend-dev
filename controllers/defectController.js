const InspectionDefect = require('../models/InspectionDefect');

// ===== Defect Catalog Endpoints =====
// @desc    Get full defects catalog
// @route   GET /api/defects
// @access  Private
exports.getAllDefects = async (req, res) => {
  try {
    const defects = await InspectionDefect.findAll({
      order: [['id', 'ASC']]
    });
    res.json(defects);
  } catch (error) {
    console.error('Error fetching defects:', error);
    res.status(500).json({ message: 'שגיאת שרת בקבלת רשימת ליקויים', error: error.message });
  }
};

// @desc    Get single defect by identifier
// @route   GET /api/defects/:id
// @access  Private
exports.getDefectById = async (req, res) => {
  try {
    const defect = await InspectionDefect.findByPk(req.params.id);
    if (defect) {
      res.json(defect);
    } else {
      res.status(404).json({ message: 'ליקוי לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};
