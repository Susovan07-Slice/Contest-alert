import requests
import time
from datetime import datetime

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

def get_codechef_contests():
    url = "https://www.codechef.com/api/list/contests/all"
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        data = response.json()
        upcoming = []
        now_epoch = time.time()
        for c in data.get('future_contests', []):
            iso_str = c.get('contest_start_date_iso')
            if iso_str:
                # Parse ISO string safely
                dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
                start_epoch = dt.timestamp()
                
                if start_epoch > now_epoch:
                    upcoming.append({
                        'id': f"cc_{c['contest_code']}",
                        'name': f"CodeChef: {c['contest_name']}",
                        'start_time_epoch': start_epoch,
                        'url': f"https://www.codechef.com/{c['contest_code']}"
                    })
        return upcoming
    except Exception as e:
        print(f"CodeChef Error: {e}")
        return []

def get_all_contests():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching CF, LC, and CC...")
    cf = get_codeforces_contests()
    lc = get_leetcode_contests()
    cc = get_codechef_contests()
    
    all_contests = cf + lc + cc
    all_contests.sort(key=lambda x: x['start_time_epoch'])
    
    # Check for same-day clashes between different platforms
    date_groups = {}
    for c in all_contests:
        date_str = datetime.fromtimestamp(c['start_time_epoch']).strftime('%Y-%m-%d')
        if date_str not in date_groups:
            date_groups[date_str] = set()
        
        platform_prefix = c['id'][:2] # 'cf', 'lc', or 'cc'
        date_groups[date_str].add(platform_prefix)
        c['date_str'] = date_str
        
    for c in all_contests:
        # If there is more than 1 unique platform on this day, flag it
        c['clash'] = len(date_groups[c['date_str']]) > 1

    print(f"Successfully fetched {len(all_contests)} upcoming contests! (CF: {len(cf)}, LC: {len(lc)}, CC: {len(cc)})\n")
    return all_contests

def main_loop():
    print("Started Contest Alarm. Will notify 3 days, 1 hour, and 10 mins before contests.")
    print("Press Ctrl+C to exit.\n")
    
    notified_milestones = set()
    last_fetch_time = 0
    contests = []
    
    MILESTONES = [
        ('10_mins', 10 * 60, "10 minutes"),
        ('1_hour', 60 * 60, "1 hour"),
        ('3_days', 3 * 24 * 60 * 60, "3 days")
    ]
    
    while True:
        now_epoch = time.time()
        
        # 1. Refresh contest list every X hours (or if it's our first run)
        if now_epoch - last_fetch_time > (REFRESH_INTERVAL_HOURS * 3600):
            contests = get_all_contests()
            last_fetch_time = now_epoch
            
        # 2. Check for upcoming contests that need an alarm
        for c in contests:
            time_until_start = c['start_time_epoch'] - now_epoch
            if time_until_start <= 0:
                continue
                
            crossed_milestone = None
            msg_str = ""
            
            for m_name, m_sec, m_label in MILESTONES:
                if time_until_start <= m_sec:
                    crossed_milestone = m_name
                    msg_str = m_label
                    break
                    
            if crossed_milestone and (c['id'], crossed_milestone) not in notified_milestones:
                # TODO: We will hook this up to Firebase Push Notifications later!
                prefix = "🔥 CLASH ALERT!" if c.get('clash') else "ALARM!"
                
                print(f"{prefix} '{c['name']}' starts in less than {msg_str}!")
                if c.get('clash'):
                    print("⚠️ Note: Prepare yourself, another platform also has a contest today!")
                print(f"Link: {c['url']}\n")
                
                notified_milestones.add((c['id'], crossed_milestone))
                
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
