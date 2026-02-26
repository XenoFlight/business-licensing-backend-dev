const axios = require('axios');
const ical = require('node-ical');

const ICAL_URL_PATTERN = /\.ics(?:$|\?)/i;
const FALLBACK_ICAL_URL = 'https://outlook.office365.com/owa/calendar/aabdac5a5e8042328a46761dd7dff9b6@yoav.org.il/cbfd940885de4af8bf9d3e51859d279d4522486375793626553/calendar.ics';

// ===== iCal URL Validation =====
// Accept only HTTPS URLs that point to an ICS resource.
function isValidIcalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ICAL_URL_PATTERN.test(parsed.pathname + parsed.search);
  } catch (error) {
    return false;
  }
}

// ===== Calendar Feed Endpoint =====
// Resolves feed URL from request body, env default, then hard fallback.
exports.getICalEvents = async (req, res) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
  const trimmedInputUrl = rawUrl.trim();
  const trimmedUrl = trimmedInputUrl || String(process.env.DEFAULT_ICAL_URL || '').trim() || FALLBACK_ICAL_URL;

  if (!trimmedUrl) {
    return res.status(500).json({ message: 'לא הוגדר קישור יומן ברירת מחדל במערכת.' });
  }

  if (!isValidIcalUrl(trimmedUrl)) {
    return res.status(400).json({ message: 'קישור היומן אינו תקין. יש להזין כתובת HTTPS שמכילה קובץ .ics' });
  }

  try {
    // Download raw iCal feed text.
    const response = await axios.get(trimmedUrl, {
      responseType: 'text'
    });

    // Parse VEVENT entries into frontend-friendly event objects.
    const data = ical.sync.parseICS(response.data);
    const events = Object.values(data)
      .filter((entry) => entry && entry.type === 'VEVENT')
      .map((event) => ({
        title: event.summary,
        start: event.start,
        end: event.end,
        allDay: !event.start?.getHours || (event.end - event.start) % (24 * 60 * 60 * 1000) === 0,
        description: event.description,
        location: event.location
      }));

    if (!response.data || !String(response.data).includes('BEGIN:VCALENDAR')) {
      return res.status(422).json({ message: 'הקישור לא מחזיר קובץ iCal תקין (BEGIN:VCALENDAR חסר).' });
    }

    res.json(events);

  } catch (error) {
    console.error('Error fetching or parsing iCal feed:', error.message);
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return res.status(422).json({ message: 'קישור היומן דורש הרשאה. יש לפרסם את היומן כקישור ציבורי (ICS).' });
    }

    // Normalize upstream fetch/parsing errors as a gateway failure.
    res.status(502).json({ message: 'לא ניתן למשוך את קובץ היומן. בדוק שהקישור ציבורי וזמין.' });
  }
};