async function fetchContests() {
  const data = await chrome.storage.local.get(['cfHandle', 'lcHandle']);
  let upcoming = [];
  const now = Date.now() / 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60;

  if (data.cfHandle) {
    try {
      const res = await fetch('https://codeforces.com/api/contest.list');
      const json = await res.json();
      if (json.status === 'OK') {
        const cfUpcoming = json.result
          .filter(c => c.phase === 'BEFORE' && c.startTimeSeconds > now && c.startTimeSeconds <= now + SEVEN_DAYS)
          .map(c => ({ name: `Codeforces: ${c.name}`, startTime: c.startTimeSeconds }));
        upcoming.push(...cfUpcoming);
      }
    } catch (e) { console.error("CF Fetch Error", e); }
  }

  if (data.lcHandle) {
    try {
      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ query: "{ allContests { title startTime } }" })
      });
      const json = await res.json();
      const lcUpcoming = (json.data?.allContests || [])
        .filter(c => c.startTime > now && c.startTime <= now + SEVEN_DAYS)
        .map(c => ({ name: `LeetCode: ${c.title}`, startTime: c.startTime }));
      upcoming.push(...lcUpcoming);
    } catch (e) { console.error("LC Fetch Error", e); }
  }

  await chrome.storage.local.set({ upcomingContests: upcoming });
  scheduleAlarms(upcoming);
}

function scheduleAlarms(contests) {
  chrome.alarms.clearAll();
  const now = Date.now() / 1000;
  
  contests.forEach(c => {
    const timeUntil = c.startTime - now;
    
    // 1 Hour Alarm
    if (timeUntil > 3600) {
      chrome.alarms.create(`1h_${c.name}`, { when: (c.startTime - 3600) * 1000 });
    }
    // 10 Min Alarm
    if (timeUntil > 600) {
      chrome.alarms.create(`10m_${c.name}`, { when: (c.startTime - 600) * 1000 });
    }
  });
  
  // Re-schedule the background polling
  chrome.alarms.create("fetchContestsLoop", { periodInMinutes: 360 });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchContests") {
    fetchContests();
  }
});

// Run once on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("fetchContestsLoop", { periodInMinutes: 360 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchContestsLoop") {
    fetchContests();
  } else {
    // It's a contest alarm! (e.g. "1h_Codeforces Round #...")
    const timeStr = alarm.name.startsWith("1h_") ? "1 Hour" : "10 Minutes";
    const contestName = alarm.name.substring(alarm.name.indexOf('_') + 1);
    
    // Inject the visual and audio alarm directly into whatever tab the user is currently looking at!
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "triggerAlarm", contest: contestName, time: timeStr });
        });
      }
    });
  }
});
