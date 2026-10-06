// Ensure we don't inject multiple overlapping alarms
if (!window.hasContestAlarm) {
  window.hasContestAlarm = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "triggerAlarm") {
      
      // 1. Create a massive visual overlay that blocks the entire screen
      const overlay = document.createElement('div');
      overlay.id = "contest-alarm-overlay-99";
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.95); z-index: 2147483647;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: white;
      `;
      
      const title = document.createElement('h1');
      title.innerText = "🚨 CONTEST ALARM 🚨";
      title.style.cssText = "color: #EF4444; font-size: 64px; margin-bottom: 20px; text-align: center; font-weight: 900;";
      
      const sub = document.createElement('h2');
      sub.innerText = `WAKE UP! '${request.contest}' starts in ${request.time}!`;
      sub.style.cssText = "color: #E5E5E5; font-size: 32px; margin-bottom: 50px; text-align: center; font-weight: bold;";
      
      const btn = document.createElement('button');
      btn.innerText = "STOP ALARM";
      btn.style.cssText = `
        background: #22C55E; color: black; font-size: 28px; font-weight: 900; 
        padding: 24px 48px; border: none; border-radius: 12px; cursor: pointer;
        box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
      `;
      
      // 2. Synthesize a loud looping siren using the Web Audio API
      // This completely bypasses the need for bundling external MP3 files!
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Main tone
      let oscillator = audioCtx.createOscillator();
      let gainNode = audioCtx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5
      
      // Siren wobble effect (LFO)
      let lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 2.5; // Wobble 2.5 times per second
      
      let lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 400; // Sweep frequency by 400Hz up and down
      
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Volume
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      
      // 3. Start the siren
      oscillator.start();
      lfo.start();
      
      // 4. Manually stop the alarm logic
      btn.onclick = () => {
        oscillator.stop();
        lfo.stop();
        audioCtx.close();
        overlay.remove();
        window.hasContestAlarm = false;
      };
      
      // 5. Mount to the user's active page
      overlay.appendChild(title);
      overlay.appendChild(sub);
      overlay.appendChild(btn);
      document.body.appendChild(overlay);
    }
  });
}
