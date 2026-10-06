import requests
import time
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, messaging

print("Initializing Firebase Admin SDK...")
try:
    cred = credentials.Certificate("firebase-admin.json")
    firebase_admin.initialize_app(cred)
    print("Firebase connected successfully!\n")
except Exception as e:
    print(f"FATAL: Could not initialize Firebase. Make sure firebase-admin.json is present. Error: {e}")
    exit(1)

REFRESH_INTERVAL_HOURS = 6

def get_codeforces_contests():
    url = "https://codeforces.com/api/contest.list"
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        data = response.json()
        upcoming = []
        if data.get('status') == 'OK':
            for c in data.get('result', []):
                if c.get('phase') == 'BEFORE':
                    upcoming.append({
                        'id': f"cf_{c['id']}",
                        'name': f"Codeforces: {c['name']}",
                        'start_time_epoch': c.get('startTimeSeconds'),
                        'url': f"https://codeforces.com/contest/{c['id']}"
                    })
        return upcoming
    except Exception as e:
        print(f"Codeforces Error: {e}")
        return []

def get_leetcode_contests():
    url = "https://leetcode.com/graphql"
    payload = {"query": "{ allContests { title startTime titleSlug } }"}
    try:
        response = requests.post(url, json=payload, headers={'User-Agent': 'Mozilla/5.0'})
        data = response.json()
        upcoming = []
        now_epoch = time.time()
        for c in data.get('data', {}).get('allContests', []):
            start_epoch = c.get('startTime')
            if start_epoch > now_epoch:
                upcoming.append({
                    'id': f"lc_{c['titleSlug']}",
                    'name': f"LeetCode: {c['title']}",
                    'start_time_epoch': start_epoch,
                    'url': f"https://leetcode.com/contest/{c['titleSlug']}"
                })
        return upcoming
    except Exception as e:
        print(f"LeetCode Error: {e}")
        return []

def get_all_contests():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching CF and LC...")
    cf = get_codeforces_contests()
    lc = get_leetcode_contests()
    
    all_contests = cf + lc
    
    # Filter only contests within the next 7 days
    now_epoch = time.time()
    seven_days = 7 * 24 * 60 * 60
    
    upcoming_7_days = [c for c in all_contests if now_epoch < c['start_time_epoch'] <= now_epoch + seven_days]
    upcoming_7_days.sort(key=lambda x: x['start_time_epoch'])
    
    # Check for same-day clashes between different platforms
    date_groups = {}
    for c in upcoming_7_days:
        date_str = datetime.fromtimestamp(c['start_time_epoch']).strftime('%Y-%m-%d')
        if date_str not in date_groups:
            date_groups[date_str] = set()
        
        platform_prefix = c['id'][:2] # 'cf' or 'lc'
        date_groups[date_str].add(platform_prefix)
        c['date_str'] = date_str
        
    for c in upcoming_7_days:
        # If there is more than 1 unique platform on this day, flag it
        c['clash'] = len(date_groups[c['date_str']]) > 1

    print(f"Successfully fetched {len(upcoming_7_days)} upcoming contests within next 7 days! (CF: {len(cf)}, LC: {len(lc)})\n")
    return upcoming_7_days

def send_push_notification(contest_name, time_str, clash=False):
    prefix = "🔥 CLASH ALERT!" if clash else "🚨 ALARM!"
    title = f"{prefix} {contest_name}"
    body = f"WAKE UP! '{contest_name}' starts in {time_str}!"
    if clash:
        body += "\n⚠️ PREPARE YOURSELF: Multiple platforms have contests today!"
        
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        topic='Coding_Contests',
        android=messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(
                sound='default'
            ),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound='default')
            )
        )
    )
    try:
        response = messaging.send(message)
        print(f"Successfully sent Firebase push notification: {response}")
    except Exception as e:
        print(f"Error sending push notification: {e}")

def main_loop():
    print("Running stateless Contest Alarm Check...")
    contests = get_all_contests()
    now_epoch = time.time()
    
    for c in contests:
        time_until_start = c['start_time_epoch'] - now_epoch
        
        # We check if the contest falls inside our 10-minute trigger windows!
        # Because this script runs every 10 minutes via GitHub Actions, we don't need a database!
        
        # Window 1: 10 minutes away (between 0 and 10 mins)
        if 0 < time_until_start <= 600:
            print(f"TRIGGER: '{c['name']}' is 10 mins away!")
            send_push_notification(c['name'], "10 minutes", c.get('clash'))
            
        # Window 2: 1 hour away (between 60 and 70 mins)
        elif 3600 < time_until_start <= 4200:
            print(f"TRIGGER: '{c['name']}' is 1 hour away!")
            send_push_notification(c['name'], "1 hour", c.get('clash'))
            
        # Window 3: 3 days away (between 72 hours and 72h + 10m)
        elif 259200 < time_until_start <= 259800:
            print(f"TRIGGER: '{c['name']}' is 3 days away!")
            send_push_notification(c['name'], "3 days", c.get('clash'))

    print("Check complete. Exiting cleanly.")

if __name__ == "__main__":
    main_loop()
