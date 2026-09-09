# FaceScan AI - Google Play Store Upload & Publish Guide 📱🚀

Yeh guide aapko **FaceScan AI** ko Google Play Store par official Android App ke roop me upload karne ka poora aasan tarika batata hai.

---

## 1. Do Tarike Hain Mobile Me Chalane Ke:

### 🌟 Tarika A: Direct Mobile Install (PWA - Zero Cost, Abhi Live Hai!)
Aapko Play Store par upload karne se pehle bhi koi bhi customer/photographer apne mobile me yeh app bina Play Store ke seedha download kar sakta hai:
1. Mobile Chrome browser me `https://facescan.co.in` kholein.
2. Screen par **"📲 Install App"** button dikhega ya Chrome me 3-dots par click karke **"Install App" / "Add to Home Screen"** karein.
3. Phone ke desktop par **FaceScan AI** ka official app icon ban jayega aur yeh bilkul native Android App ki tarah bina URL bar ke chalega!

---

### 🏪 Tarika B: Google Play Store Par Official Publish Karna (Trusted Web Activity - TWA)
Google ka official standard web apps ko Play Store par daalne ke liye **Trusted Web Activity (TWA)** hota hai. Iska sabse bada fayda yeh hai ki:
- Jab bhi aap website par koi feature update karenge, Play Store app me woh **automatically bina app update kiye turant live** ho jayega!

---

## 2. Play Store Upload Step-by-Step:

### Step 1: Google Play Console Account Banayein
1. [Google Play Console](https://play.google.com/console/signup) par jayein.
2. Apne Google / Gmail account se login karein.
3. Google Play Developer One-time Registration Fee pay karein ($25 lagta hai lifetime ke liye ~₹2,100).
4. Apna Developer Name dalein (e.g. `FaceScan Technologies` ya aapke studio ka naam).

### Step 2: Android App Bundle (.aab) Generate Karein
Google ka official open-source tool **Bubblewrap** 1-click me aapke website URL (`https://facescan.co.in`) se Play Store ready `.aab` bana deta hai.

1. Apne computer me terminal me run karein:
   ```bash
   npm install -g @bubblewrap/cli
   ```
2. Humare `android/` folder me jayein aur run karein:
   ```bash
   bubblewrap init --manifest=https://facescan.co.in/manifest.json
   bubblewrap build
   ```
3. Yeh aapko ek file dega: **`app-release-bundle.aab`**

### Step 3: Google Play Console Me Upload Karein
1. Play Console me **"Create App"** par click karein.
   - App Name: `FaceScan AI - Smart Wedding Photo Sharing`
   - Default Language: `English (India)`
   - App or Game: `App`
   - Free or Paid: `Free`
2. **Dashboard** ➔ **Production** ➔ **Create new release** par click karein.
3. **`app-release-bundle.aab`** file upload karein.
4. App description, screenshots aur logo upload karein:
   - App Icon: `frontend/icons/icon-512.png`
   - Category: `Photography`
5. **"Send for Review"** click karein!

Google 24-48 ghante me review karke aapki app ko Google Play Store par **LIVE** kar dega!
Uske baad koi bhi photographer ya wedding guest seedha Google Play Store se search karke **FaceScan AI** download kar payega!
