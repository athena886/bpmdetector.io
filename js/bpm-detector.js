(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const input = $('audio-file');
  const dropZone = $('drop-zone');
  const uploadView = $('upload-view');
  const analysisView = $('analysis-view');
  const analyzing = $('analyzing-state');
  const resultPanel = $('result-panel');
  const status = $('tool-status');
  const progress = $('progress-bar');
  const allowedExtensions = /\.(mp3|wav|m4a|aac|ogg)$/i;

  function setProgress(value) { progress.style.width = `${value}%`; }
  function showError(message) {
    analyzing.hidden = true;
    resultPanel.hidden = false;
    resultPanel.innerHTML = `<div class="result-main"><div class="bpm-readout"><span>!</span></div><p>${message}</p></div><div class="result-actions"><button class="button primary" id="error-reset" type="button">Choose another file</button></div>`;
    status.textContent = 'Could not analyze';
    document.getElementById('error-reset').addEventListener('click', reset);
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  }

  function detectTempo(buffer) {
    const targetRate = 11025;
    const stride = Math.max(1, Math.floor(buffer.sampleRate / targetRate));
    const rate = buffer.sampleRate / stride;
    const maxSamples = Math.min(Math.floor(buffer.length / stride), Math.floor(rate * 180));
    const channels = Math.min(buffer.numberOfChannels, 2);
    const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
    const frameSize = 1024;
    const hop = 512;
    const envelope = [];
    let previousEnergy = 0;

    for (let start = 0; start + frameSize < maxSamples; start += hop) {
      let energy = 0;
      for (let i = 0; i < frameSize; i++) {
        const sourceIndex = (start + i) * stride;
        let sample = 0;
        for (let c = 0; c < channels; c++) sample += data[c][sourceIndex] || 0;
        sample /= channels;
        energy += sample * sample;
      }
      energy = Math.sqrt(energy / frameSize);
      envelope.push(Math.max(0, energy - previousEnergy * 0.86));
      previousEnergy = energy;
    }

    if (envelope.length < 80) throw new Error('This file is too short for a reliable tempo estimate.');
    const baseline = median(envelope);
    for (let i = 0; i < envelope.length; i++) envelope[i] = Math.max(0, envelope[i] - baseline * 1.35);

    const minBpm = 55;
    const maxBpm = 210;
    const scores = [];
    for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.25) {
      const lag = Math.round((60 * rate) / (hop * bpm));
      let score = 0;
      let normA = 0;
      let normB = 0;
      for (let i = lag; i < envelope.length; i++) {
        const a = envelope[i];
        const b = envelope[i - lag];
        score += a * b;
        normA += a * a;
        normB += b * b;
      }
      const correlation = score / Math.sqrt(normA * normB + 1e-12);
      const centerBias = 1 - Math.min(0.08, Math.abs(bpm - 120) / 2000);
      scores.push({ bpm, score: correlation * centerBias });
    }
    scores.sort((a, b) => b.score - a.score);
    let winner = scores[0];
    const related = scores.filter(item => Math.abs(item.bpm - winner.bpm) > 4 && Math.abs(item.bpm - winner.bpm * 2) > 4 && Math.abs(item.bpm * 2 - winner.bpm) > 4);
    const runnerUp = related[0] || scores[1];

    // Prefer the common musical interpretation when octave-related candidates are close.
    if (winner.bpm < 78) {
      const doubled = scores.find(item => Math.abs(item.bpm - winner.bpm * 2) < .5);
      if (doubled && doubled.score > winner.score * .82) winner = doubled;
    } else if (winner.bpm > 172) {
      const halved = scores.find(item => Math.abs(item.bpm - winner.bpm / 2) < .5);
      if (halved && halved.score > winner.score * .86) winner = halved;
    }

    const bpm = Math.round(winner.bpm);
    const clarity = Math.max(0, Math.min(1, (winner.score - runnerUp.score) / Math.max(winner.score, .01) * 2.2 + winner.score * .7));
    return { bpm, confidence: clarity };
  }

  async function analyzeFile(file) {
    if (!file || (!file.type.startsWith('audio/') && !allowedExtensions.test(file.name))) {
      uploadView.hidden = true; analysisView.hidden = false; showError('Choose an MP3, WAV, M4A, AAC, or OGG audio file.'); return;
    }
    uploadView.hidden = true;
    analysisView.hidden = false;
    analyzing.hidden = false;
    resultPanel.hidden = true;
    $('file-name').textContent = file.name;
    status.textContent = 'Analyzing locally';
    setProgress(12);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(42);
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is not supported in this browser.');
      const context = new AudioContextClass();
      const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
      setProgress(76);
      await new Promise(resolve => setTimeout(resolve, 30));
      const result = detectTempo(audioBuffer);
      await context.close();
      setProgress(100);
      displayResult(result);
    } catch (error) {
      console.warn('BPM analysis stopped:', error.message);
      showError(error.message.includes('decode') ? 'This audio codec is not supported by your browser. Try MP3 or WAV.' : error.message);
    }
  }

  function displayResult({ bpm, confidence }) {
    analyzing.hidden = true;
    resultPanel.hidden = false;
    $('bpm-value').textContent = bpm;
    $('half-time').textContent = `${Math.round(bpm / 2)} half-time`;
    $('double-time').textContent = `${bpm * 2} double-time`;
    const confidenceLabel = confidence > .58 ? 'High confidence' : confidence > .28 ? 'Medium confidence' : 'Low confidence — tap to verify';
    $('confidence-text').textContent = confidenceLabel;
    $('tempo-feel').textContent = bpm >= 165 ? 'Fast / double-time feel' : bpm <= 75 ? 'Slow / half-time feel' : bpm >= 120 ? 'Upbeat tempo' : 'Steady tempo';
    $('pulse-orbit').style.animationDuration = `${60 / bpm}s`;
    $('pulse-orbit').querySelector('span').style.animationDuration = `${60 / bpm}s`;
    status.textContent = 'Analysis complete';
    window.currentBpm = bpm;
  }

  function reset() { window.location.reload(); }
  function useVariant(value) {
    $('bpm-value').textContent = value;
    window.currentBpm = value;
    $('pulse-orbit').querySelector('span').style.animationDuration = `${60 / value}s`;
  }

  input.addEventListener('change', () => analyzeFile(input.files[0]));
  ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
  dropZone.addEventListener('drop', event => analyzeFile(event.dataTransfer.files[0]));
  $('analyze-another').addEventListener('click', reset);
  $('copy-bpm').addEventListener('click', async event => {
    const value = String(window.currentBpm || $('bpm-value').textContent);
    try { await navigator.clipboard.writeText(value); } catch (_) {
      const temp = document.createElement('textarea'); temp.value = value; document.body.appendChild(temp); temp.select(); document.execCommand('copy'); temp.remove();
    }
    event.currentTarget.textContent = 'Copied!';
    setTimeout(() => { event.currentTarget.textContent = 'Copy BPM'; }, 1400);
  });
  $('half-time').addEventListener('click', () => useVariant(Math.round((window.currentBpm || 0) / 2)));
  $('double-time').addEventListener('click', () => useVariant((window.currentBpm || 0) * 2));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
})();
