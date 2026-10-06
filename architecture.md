# Architecture and Implementation Flow

## 🏛️ Architecture Overview
- **Path Selected**: Architecture 2 (Python Backend + Mobile App Frontend).
- **How it works**:
  - **Backend**: A Python daemon runs 24/7 on a cloud server (like Render/Heroku). It monitors coding contest schedules and does the heavy lifting.
  - **Middleman**: Firebase Cloud Messaging (FCM) routes push notifications to the devices.
  - **Frontend**: A React Native (Expo) mobile app receives the push notifications and displays a beautiful UI of upcoming contests on iOS and Android.
- **Data Sources (APIs)**:
  - Codeforces Official API (`codeforces.com/api/contest.list`)
  - CLIST API (For LeetCode/CodeChef)

## 🗺️ Implementation Flow

### Phase 1: The Python Backend (Days 1-4) ✅
- **Goal**: Build the brain that monitors the time.
```mermaid
graph TD;
    A[Fetch Codeforces API] --> B[Filter upcoming contests];
    B --> C[Convert timestamps to Epoch];
    C --> D[Infinite loop checks time against 3-day, 1-hr, 10-min milestones];
```

### Phase 2: The Mobile App Frontend (Days 5-6)
- **Goal**: Create the React Native mobile app.
```mermaid
graph TD;
    A[Init React Native Expo project] --> B[Build clean UI for Contest List];
    B --> C[Fetch backend or APIs for UI data];
    C --> D[Run on physical phone via Expo Go];
```

### Phase 3: Wiring up Push Notifications (Days 7-8)
- **Goal**: Connect the Python brain to the mobile phone.
```mermaid
graph TD;
    A[Setup Firebase Project FCM] --> B[Mobile App generates Device Token];
    B --> C[Mobile App sends Token to Python Server];
    C --> D[Python Server fires Push Notification at milestones];
```

### Phase 4: Polish & Cloud Deployment (Days 9-10)
- **Goal**: Deploy the server and polish the app.
```mermaid
graph TD;
    A[Deploy Python script to Render/Heroku] --> B[Add App Icons & Splash Screen];
    B --> C[Test Push Notifications on iOS/Android];
    C --> D[Enjoy your Professional Mobile App!];
```
