document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['cfUrl', 'lcUrl'], (data) => {
    if (data.cfUrl) document.getElementById('cfUrl').value = data.cfUrl;
    if (data.lcUrl) document.getElementById('lcUrl').value = data.lcUrl;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const cfUrl = document.getElementById('cfUrl').value;
    const lcUrl = document.getElementById('lcUrl').value;
    
    const extractAndValidateCF = (url) => {
        if (!url) return '';
        const match = url.trim().match(/^https?:\/\/(www\.)?codeforces\.com\/profile\/([A-Za-z0-9_-]+)\/?$/i);
        return match ? match[2] : null;
    };

    const extractAndValidateLC = (url) => {
        if (!url) return '';
        const match = url.trim().match(/^https?:\/\/(www\.)?leetcode\.com\/(u\/)?([A-Za-z0-9_-]+)\/?$/i);
        return match ? match[3] : null;
    };
    
    const cfHandle = cfUrl ? extractAndValidateCF(cfUrl) : '';
    const lcHandle = lcUrl ? extractAndValidateLC(lcUrl) : '';
    
    if (cfUrl && !cfHandle) {
        document.getElementById('status').innerText = "Invalid CF URL. Format: https://codeforces.com/profile/user";
        document.getElementById('status').style.color = "#EF4444";
        document.getElementById('status').style.display = 'block';
        return;
    }
    
    if (lcUrl && !lcHandle) {
        document.getElementById('status').innerText = "Invalid LC URL. Format: https://leetcode.com/u/user";
        document.getElementById('status').style.color = "#EF4444";
        document.getElementById('status').style.display = 'block';
        return;
    }
    
    if (!cfHandle && !lcHandle) {
        document.getElementById('status').innerText = "Please provide at least one valid profile URL.";
        document.getElementById('status').style.color = "#EF4444";
        document.getElementById('status').style.display = 'block';
        return;
    }

    document.getElementById('status').innerText = "Profiles Saved! Alarms Active.";
    document.getElementById('status').style.color = "#22C55E";
    
    chrome.storage.local.set({ cfUrl, lcUrl, cfHandle, lcHandle }, () => {
      document.getElementById('status').style.display = 'block';
      setTimeout(() => { document.getElementById('status').style.display = 'none'; }, 2000);
      
      // Trigger background script to fetch contest data immediately
      chrome.runtime.sendMessage({ action: "fetchContests" });
    });
  });
});
