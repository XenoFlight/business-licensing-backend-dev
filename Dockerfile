# שימוש בתמונת בסיס רשמית של Node.js (גרסה קלה)
# Use official Node.js slim image
FROM node:18-slim

# התקנת ספריות נדרשות עבור Puppeteer וגופנים לעברית
# Install dependencies for Puppeteer and Hebrew fonts
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && apt-get install -y fonts-noto fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# הגדרת תיקיית העבודה
# Set working directory
WORKDIR /usr/src/app

# העתקת קבצי התלות
# Copy package files
COPY package*.json ./

# התקנת התלויות (כולל Puppeteer)
# Install dependencies
# אנו מדלגים על הורדת כרום של פאפטיר כי התקנו כרום יציב למעלה
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm install --omit=dev

# העתקת שאר קבצי הפרויקט
# Copy app source
COPY . .

# יצירת תיקייה לדו"חות אם לא קיימת
RUN mkdir -p public/reports

# חשיפת הפורט
# Expose port
EXPOSE 8080

# הגדרת משתני סביבה
ENV NODE_ENV=production

# הפעלת השרת
# Start server
CMD [ "npm", "start" ]
