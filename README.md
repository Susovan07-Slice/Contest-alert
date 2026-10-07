# 🚨 Contest Alarm Tracker

**Never miss another coding contest again.** 

The Contest Alarm Tracker is an ultimate, fully automated companion for competitive programmers. It natively tracks your official Codeforces and LeetCode schedules in the background, ensuring you wake up precisely 1 hour and 10 minutes before a contest begins.

## 📱 Download the Mobile App (Android)
The mobile app features a beautiful dark-mode interface and runs completely silently in the background. It connects to our 24/7 cloud server via Google Firebase Cloud Messaging to receive remote push notifications.

### [👉 Click Here to Download `app.apk`](https://github.com/Susovan07-Slice/Contest-alert/blob/development/app.apk?raw=true)

**Installation Instructions:**
1. Click the link above to download the `app.apk` file.
2. Tap the downloaded file on your Android device to install it.
3. If your phone blocks the installation, tap **Settings** and enable **"Install from unknown sources"**.
4. Open the app, allow Push Notifications, and paste your Codeforces or LeetCode URL to securely lock in your session!

## 🌐 Browser Extension (Desktop)
If you are already on your computer, the browser extension acts as the ultimate failsafe. Exactly 1 hour and 10 minutes before a contest, it will inject a massive, unblockable visual overlay directly onto whichever browser tab you are actively reading, accompanied by a blaring manual siren alarm.
* Currently in review on the **Microsoft Edge Add-ons Store**!

## ✨ Key Features
* **Zero Cloud Tracking:** The mobile app stores all data locally on your device. We do not use any databases.
* **100% Free Cloud Architecture:** Powered by a free GitHub Actions CRON server that wakes up every 10 minutes to verify the official APIs.
* **Topic Pub/Sub Messaging:** Uses Firebase Cloud Messaging to broadcast alarms to all users simultaneously without draining phone batteries.
* **Clash Detection:** Automatically warns you if both Codeforces and LeetCode schedule a contest on the same day.

## 🛠️ Tech Stack
* **Frontend:** React Native (Expo), Vanilla JS/CSS (Browser Extension)
* **Backend:** Python (GitHub Actions stateless script)
* **Infrastructure:** Firebase Cloud Messaging (FCM) Admin SDK
