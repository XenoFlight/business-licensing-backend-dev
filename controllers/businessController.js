const { Business, LicensingItem, Report, User } = require('../models');
const { normalizeBusinessStatus, getBusinessStatusLabel } = require('../utils/businessStatus');

// ===== Business Serialization Helper =====
// Ensures status is normalized and always includes a human-readable status label.
function serializeBusinessWithStatus(business) {
  const plainBusiness = business?.toJSON ? business.toJSON() : business;
  const normalizedStatus = normalizeBusinessStatus(plainBusiness?.status) || 'application_submitted';

  return {
    ...plainBusiness,
    status: normalizedStatus,
    statusLabel: getBusinessStatusLabel(normalizedStatus),
  };
}

function normalizeBusinessPayload(payloadInput) {
  const payload = { ...payloadInput };

  if (Object.prototype.hasOwnProperty.call(payload, 'licensingItemIds')) {
    if (payload.licensingItemIds == null) {
      payload.licensingItemIds = null;
    } else if (!Array.isArray(payload.licensingItemIds)) {
      const error = new Error('licensingItemIds חייב להיות מערך');
      error.statusCode = 400;
      throw error;
    } else {
      const parsedIds = payload.licensingItemIds
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0);

      payload.licensingItemIds = Array.from(new Set(parsedIds));
      payload.licensingItemId = payload.licensingItemIds.length > 0 ? payload.licensingItemIds[0] : null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'licensingItemId') && !Object.prototype.hasOwnProperty.call(payload, 'licensingItemIds')) {
    if (!payload.licensingItemId) {
      payload.licensingItemIds = null;
    } else {
      const parsedId = Number.parseInt(payload.licensingItemId, 10);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        const error = new Error('ערך licensingItemId לא תקין');
        error.statusCode = 400;
        throw error;
      }

      payload.licensingItemId = parsedId;
      payload.licensingItemIds = [parsedId];
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'regulatorApprovals')) {
    if (payload.regulatorApprovals == null) {
      payload.regulatorApprovals = null;
    } else if (typeof payload.regulatorApprovals !== 'object' || Array.isArray(payload.regulatorApprovals)) {
      const error = new Error('regulatorApprovals חייב להיות אובייקט');
      error.statusCode = 400;
      throw error;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const normalizedStatus = normalizeBusinessStatus(payload.status);
    if (!normalizedStatus) {
      const error = new Error('סטטוס עסק לא תקין');
      error.statusCode = 400;
      throw error;
    }

    payload.status = normalizedStatus;
  }

  ['localStaffCount', 'trashCanCount'].forEach((fieldName) => {
    if (!Object.prototype.hasOwnProperty.call(payload, fieldName)) {
      return;
    }

    if (payload[fieldName] === '' || payload[fieldName] === null) {
      payload[fieldName] = null;
      return;
    }

    const parsedValue = Number.parseInt(payload[fieldName], 10);
    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      const error = new Error(`ערך לא תקין עבור ${fieldName}`);
      error.statusCode = 400;
      throw error;
    }

    payload[fieldName] = parsedValue;
  });

  if (Object.prototype.hasOwnProperty.call(payload, 'hasTrashCans')) {
    if (payload.hasTrashCans === false) {
      payload.trashCanType = null;
      payload.trashCanCount = null;
      payload.wastePickupSchedule = null;
      payload.trashCareOwner = 'unknown';
    }

    if (payload.hasTrashCans === true && !payload.trashCareOwner) {
      payload.trashCareOwner = 'unknown';
    }
  }

  return payload;
}

async function validateLicensingReferences(payload) {
  const licensingIds = Array.isArray(payload.licensingItemIds)
    ? payload.licensingItemIds
    : (payload.licensingItemId ? [payload.licensingItemId] : []);

  if (licensingIds.length === 0) {
    return;
  }

  const existingItems = await LicensingItem.findAll({
    where: { id: licensingIds },
    attributes: ['id'],
  });

  const existingIds = new Set(existingItems.map((item) => item.id));
  const missingId = licensingIds.find((id) => !existingIds.has(id));

  if (missingId) {
    const error = new Error(`פריט רישוי לא תקין או לא נמצא: ${missingId}`);
    error.statusCode = 400;
    throw error;
  }
}

// ===== Business Endpoints =====
// @desc    Get all businesses
// @route   GET /api/businesses
// @access  Private
exports.getAllBusinesses = async (req, res) => {
  try {
    const { name } = req.query;
    const where = {};

    if (name) {
      where.businessName = name;
    }

    // Fetch businesses with optional query filters.
    const businesses = await Business.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    const normalizedBusinesses = businesses.map(serializeBusinessWithStatus);
    res.json(normalizedBusinesses);
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ message: 'שגיאת שרת בקבלת רשימת עסקים', error: error.message });
  }
};

// @desc    Get business by identifier
// @route   GET /api/businesses/:id
// @access  Private
exports.getBusinessById = async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id, {
      include: [
        { model: Report }
      ]
    });

    if (business) {
      res.json(serializeBusinessWithStatus(business));
    } else {
      res.status(404).json({ message: 'עסק לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};

// @desc    Get report history for a business
// @route   GET /api/businesses/:id/reports
// @access  Private
exports.getBusinessReports = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { businessId: req.params.id },
      include: [
        { 
          model: User, 
          as: 'inspector',
          attributes: ['id', 'fullName', 'email'] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching business reports:', error);
    res.status(500).json({ message: 'שגיאת שרת בקבלת היסטוריית ביקורות', error: error.message });
  }
};

// @desc    Create new business license application
// @route   POST /api/businesses
// @access  Private (Manager/Inspector/Admin)
exports.createBusiness = async (req, res) => {
  try {
    const payload = normalizeBusinessPayload(req.body);
    await validateLicensingReferences(payload);

    const newBusiness = await Business.create(payload);
    
    res.status(201).json({
      message: 'העסק נוצר בהצלחה',
      business: newBusiness
    });
  } catch (error) {
    console.error('Error creating business:', error);
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ message: 'שגיאה ביצירת עסק', error: error.message });
  }
};

// @desc    Update business details
// @route   PUT /api/businesses/:id
// @access  Private (Manager)
exports.updateBusiness = async (req, res) => {
  try {
    const payload = normalizeBusinessPayload(req.body);
    await validateLicensingReferences(payload);

    const business = await Business.findByPk(req.params.id);

    if (business) {
      await business.update(payload);
      res.json({
        message: 'פרטי העסק עודכנו בהצלחה',
        business: business
      });
    } else {
      res.status(404).json({ message: 'עסק לא נמצא' });
    }
  } catch (error) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ message: 'שגיאה בעדכון עסק', error: error.message });
  }
};

// @desc    Update business status only
// @route   PATCH /api/businesses/:id/status
// @access  Private (Manager/Inspector)
exports.updateBusinessStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const normalizedStatus = normalizeBusinessStatus(status);
    if (!normalizedStatus) {
      return res.status(400).json({ message: 'סטטוס עסק לא תקין' });
    }

    const business = await Business.findByPk(req.params.id);

    if (business) {
      business.status = normalizedStatus;
      await business.save();
      res.json({
        message: 'סטטוס העסק עודכן בהצלחה',
        business: serializeBusinessWithStatus(business)
      });
    } else {
      res.status(404).json({ message: 'עסק לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בעדכון סטטוס עסק', error: error.message });
  }
};

// @desc    Update business map coordinates
// @route   PATCH /api/businesses/:id/location
// @access  Private (Manager/Inspector/Admin)
exports.updateBusinessLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    // Validate numeric latitude/longitude ranges.
    if (typeof latitude !== 'number' || Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ message: 'ערך קו רוחב לא תקין' });
    }

    if (typeof longitude !== 'number' || Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: 'ערך קו אורך לא תקין' });
    }

    const business = await Business.findByPk(req.params.id);

    if (!business) {
      return res.status(404).json({ message: 'עסק לא נמצא' });
    }

    business.latitude = latitude;
    business.longitude = longitude;
    await business.save();

    return res.json({
      message: 'מיקום העסק עודכן בהצלחה',
      business: serializeBusinessWithStatus(business)
    });
  } catch (error) {
    return res.status(500).json({ message: 'שגיאה בעדכון מיקום עסק', error: error.message });
  }
};

// @desc    Delete business
// @route   DELETE /api/businesses/:id
// @access  Private (Admin)
exports.deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id);

    if (business) {
      await business.destroy();
      res.json({ message: 'העסק נמחק בהצלחה' });
    } else {
      res.status(404).json({ message: 'עסק לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת במחיקת עסק', error: error.message });
  }
};