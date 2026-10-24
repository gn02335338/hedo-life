import { createEventCursor } from './combat-events.js';

// Short original synthesized foley. No autoplay, music downloads, gameplay
// timers or network requests; a real user gesture creates/resumes Web Audio.
export function createFeedback({ host = globalThis } = {}) {
  const cursor = createEventCursor();
  let context = null, master = null, noise = null, enabled = true, destroyed = false;
  const voices = new Set();
  let lastHit = -10, lastStep = -10, lastX = null, lastZ = null, travel = 0;
  let lastRun = null, lastTime = -1;

  function stopVoice(voice) {
    voices.delete(voice);
    try { voice.source.stop(); } catch { /* Finished already. */ }
    for (const node of voice.nodes) try { node.disconnect(); } catch { /* Gone. */ }
  }
  function unlock() {
    if (destroyed || !enabled) return;
    try {
      if (!context) {
        const Audio = host.AudioContext || host.webkitAudioContext;
        if (!Audio) return;
        context = new Audio({ latencyHint: 'interactive' });
        master = context.createGain(); master.gain.value = 0.16; master.connect(context.destination);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.7), context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (context.state === 'suspended') context.resume()?.catch?.(() => {});
    } catch { /* Silent play remains available on restricted browsers. */ }
  }
  function voice({ type = 'noise', frequency = 500, end = frequency, duration = 0.1, volume = 0.3, filter = 'bandpass', q = 0.7, when = 0 }) {
    if (!context || context.state !== 'running' || !enabled || destroyed) return;
    while (voices.size >= 22) stopVoice(voices.values().next().value);
    const now = context.currentTime + when;
    const source = type === 'noise' ? context.createBufferSource() : context.createOscillator();
    const gain = context.createGain(), tone = context.createBiquadFilter();
    tone.type = filter; tone.Q.value = q;
    tone.frequency.setValueAtTime(frequency, now);
    tone.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + duration);
    if (type === 'noise') source.buffer = noise;
    else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, now);
      source.frequency.exponentialRampToValueAtTime(Math.max(28, end), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(tone); tone.connect(gain); gain.connect(master);
    const entry = { source, nodes: [source, tone, gain] }; voices.add(entry);
    source.onended = () => { voices.delete(entry); entry.nodes.forEach(node => node.disconnect()); };
    source.start(now); source.stop(now + duration + 0.01);
  }
  function sound(event) {
    const heavy = event.heavy || event.combo === 3;
    if (event.type === 'strike') {
      voice({ frequency: heavy ? 950 : 1600, end: 230, duration: heavy ? 0.16 : 0.1, volume: 0.25 });
    } else if (event.type === 'hit') {
      // Cleave may damage several foes on one tick; mix one impact instead of
      // multiplying volume by the number of targets in the cone.
      if (event.time - lastHit < 0.035) return;
      lastHit = event.time;
      voice({ frequency: heavy ? 680 : 1250, end: 150, duration: heavy ? 0.16 : 0.09, volume: 0.65, q: 0.9 });
      voice({ type: 'sine', frequency: heavy ? 105 : 155, end: 43, duration: 0.13, volume: heavy ? 0.7 : 0.42, filter: 'lowpass' });
      if (event.weapon === 'mug') voice({ type: 'triangle', frequency: 820, end: 670, duration: 0.12, volume: 0.13, q: 2 });
    } else if (event.type === 'player-hit') {
      voice({ frequency: 320, end: 90, duration: 0.18, volume: 0.65, filter: 'lowpass' });
      voice({ type: 'sine', frequency: 82, end: 36, duration: 0.18, volume: 0.7, filter: 'lowpass' });
    } else if (event.type === 'dash') {
      voice({ frequency: 650, end: 2600, duration: 0.19, volume: 0.22 });
    } else if (event.type === 'cast' && event.skill === 'burst') {
      voice({ frequency: 2500, end: 150, duration: 0.32, volume: 0.75, filter: 'lowpass' });
      voice({ type: 'sine', frequency: 130, end: 37, duration: 0.25, volume: 0.65, filter: 'lowpass' });
    } else if (event.type === 'cast' && event.skill === 'potion') {
      voice({ type: 'triangle', frequency: 470, end: 690, duration: 0.12, volume: 0.18 });
      voice({ type: 'sine', frequency: 690, end: 840, duration: 0.16, volume: 0.15, when: 0.08 });
    } else if (event.type === 'death' && event.bossId) {
      voice({ frequency: 750, end: 80, duration: 0.55, volume: 0.6, filter: 'lowpass' });
    }
  }
  function consume(state) {
    if (state?.runId !== lastRun || state?.time < lastTime) {
      suspend(); lastHit = lastStep = -10;
      lastRun = state?.runId;
    }
    lastTime = state?.time || 0;
    const events = cursor.read(state);
    if (state?.time < lastStep || (lastX !== null && Math.hypot(state.player.x - lastX, state.player.z - lastZ) > 3)) {
      travel = 0; lastStep = -10; lastHit = -10;
    }
    for (const event of events) sound(event);
    const p = state?.player;
    if (!p) return;
    if (lastX !== null) travel += Math.min(0.3, Math.hypot(p.x - lastX, p.z - lastZ));
    lastX = p.x; lastZ = p.z;
    if (p.dashTimer > 0 || p.action?.kind === 'attack') { travel = 0; return; }
    if (travel > 1.05 && state.time - lastStep > 0.14) {
      travel %= 1.05; lastStep = state.time;
      voice({ frequency: 430, end: 105, duration: 0.055, volume: 0.13, filter: 'lowpass' });
    }
  }
  function suspend() {
    for (const entry of [...voices]) stopVoice(entry);
    lastX = lastZ = null; travel = 0;
  }
  return {
    unlock, consume, suspend,
    toggle() { enabled = !enabled; if (enabled) unlock(); else suspend(); return enabled; },
    get enabled() { return enabled; },
    destroy() {
      if (destroyed) return; destroyed = true; suspend();
      try { master?.disconnect(); context?.close()?.catch?.(() => {}); } catch { /* Already closed. */ }
      context = master = noise = null;
    },
  };
}
