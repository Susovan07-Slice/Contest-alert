import requests
from datetime import datetime

def get_codeforces_contests():
    """
    Fetches upcoming contests from the Codeforces API.
    """
    url = "https://codeforces.com/api/contest.list"
    try:
        print(f"Fetching data from {url}...")
        response = requests.get(url)
        response.raise_for_status()  # Check for HTTP errors
        data = response.json()
        
        if data['status'] != 'OK':
            print("Error: API returned status", data['status'])
            return []
            
        contests = data['result']
        upcoming_contests = []
        
        for c in contests:
            # We only care about contests that haven't started yet
            if c.get('phase') == 'BEFORE':
                start_time_seconds = c.get('startTimeSeconds')
                # Convert the unix timestamp to a readable datetime object
                start_time_local = datetime.fromtimestamp(start_time_seconds)
                
                upcoming_contests.append({
                    'id': f"cf_{c['id']}",
                    'name': c['name'],
                    'start_time': start_time_local,
                    'start_time_epoch': start_time_seconds,
                    'url': f"https://codeforces.com/contest/{c['id']}"
                })
        
        # Sort contests so the soonest one is first (ascending order)
        upcoming_contests.sort(key=lambda x: x['start_time_epoch'])
        return upcoming_contests
        
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch from Codeforces: {e}")
        return []

if __name__ == "__main__":
    contests = get_codeforces_contests()
    print(f"\nFound {len(contests)} upcoming Codeforces contests:\n")
    for contest in contests:
        print(f"- {contest['name']}")
        print(f"  Starts at: {contest['start_time']}")
        print(f"  URL: {contest['url']}\n")
