import requests
import time
from datetime import datetime

REFRESH_INTERVAL_HOURS = 6

def get_codeforces_contests():
    url = "https://codeforces.com/api/contest.list"
    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching Codeforces data...")
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] != 'OK':
            return []
            
        upcoming = []
        for c in data['result']:
            if c.get('phase') == 'BEFORE':
                upcoming.append({
                    'id': f"cf_{c['id']}",
                    'name': c['name'],
                    'start_time_epoch': c.get('startTimeSeconds'),
                    'url': f"https://codeforces.com/contest/{c['id']}"
                })
        
        upcoming.sort(key=lambda x: x['start_time_epoch'])
        return upcoming
        
    except Exception as e:
        print(f"Failed to fetch Codeforces: {e}")
        return []

def main_loop():
    print("Started Contest Alarm. Will notify 3 days, 1 hour, and 10 mins before contests.")
    print("Press Ctrl+C to exit.\n")
    
    notified_milestones = set()
    last_fetch_time = 0
    contests = []
    
    # Milestone definitions ordered from smallest to largest
    MILESTONES = [
        ('10_mins', 10 * 60, "10 minutes"),
        ('1_hour', 60 * 60, "1 hour"),
        ('3_days', 3 * 24 * 60 * 60, "3 days")
    ]
    
    while True:
        now_epoch = time.time()
        
        # 1. Refresh contest list every X hours (or if it's our first run)
        if now_epoch - last_fetch_time > (REFRESH_INTERVAL_HOURS * 3600):
            contests = get_codeforces_contests()
            last_fetch_time = now_epoch
            
        # 2. Check for upcoming contests that need an alarm
        for c in contests:
            time_until_start = c['start_time_epoch'] - now_epoch
            if time_until_start <= 0:
                continue
                
            crossed_milestone = None
            msg_str = ""
            
            # Find the smallest milestone bracket we are currently inside
            for m_name, m_sec, m_label in MILESTONES:
                if time_until_start <= m_sec:
                    crossed_milestone = m_name
                    msg_str = m_label
                    break
                    
            if crossed_milestone and (c['id'], crossed_milestone) not in notified_milestones:
                # TODO: In Day 5-6 we will replace this with an OS Desktop Notification!
                print(f"\n🔔 ALARM! '{c['name']}' starts in less than {msg_str}!")
                print(f"Link: {c['url']}\n")
                
                # Mark this specific milestone as notified
                notified_milestones.add((c['id'], crossed_milestone))
                
                # Mark any larger milestones as notified so they don't trigger retroactively
                # (e.g., if you start the script 5 mins before a contest, it shouldn't also send the 3-day alarm)
                if crossed_milestone == '10_mins':
                    notified_milestones.add((c['id'], '1_hour'))
                    notified_milestones.add((c['id'], '3_days'))
                elif crossed_milestone == '1_hour':
                    notified_milestones.add((c['id'], '3_days'))
                
        # 3. Sleep for a minute before checking the clocks again
        time.sleep(60)

if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        print("\nExiting Contest Alarm...")
