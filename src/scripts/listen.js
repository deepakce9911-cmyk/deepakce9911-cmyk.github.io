// "Listen to this article": reads the post aloud with the browser's built-in speech engine.
// Speaks one block at a time (Chrome cuts off long utterances), highlights the block being read,
// and stays hidden in browsers without speech synthesis.
(() => {
  const player = document.querySelector('[data-listen]');
  const article = document.querySelector('article');
  if (!player || !article || !('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const SKIP = '.section--sources, .table-wrap, .byline, .listen, .summarize, .author-cards, .cta-actions, .toc';
  const blocks = [...article.querySelectorAll('h1, h2, h3, p, li')]
    .filter((el) => !el.closest(SKIP) && !el.querySelector('p, li') && el.innerText.trim())
    .map((el) => ({ el, text: el.innerText.replace(/\s+/g, ' ').trim() }));
  const words = (s) => s.split(' ').length;
  const totalWords = blocks.reduce((n, b) => n + words(b.text), 0);
  const WORDS_PER_MINUTE = 170;

  const playButton = player.querySelector('[data-action="toggle"]');
  const speedButton = player.querySelector('[data-action="speed"]');
  const bar = player.querySelector('[data-progress]');
  const fill = player.querySelector('[data-progress] span');
  const status = player.querySelector('[data-status]');
  const speeds = [1, 1.25, 1.5, 0.75];

  let index = 0;
  let speed = 1;
  let playing = false;
  let voice = null;

  const minutes = (n) => Math.max(1, Math.round(n / (WORDS_PER_MINUTE * speed)));
  const pickVoice = () => {
    const voices = synth.getVoices().filter((v) => /^en(-|_)/i.test(v.lang));
    voice = voices.find((v) => /natural|neural|google|samantha|aria|jenny/i.test(v.name)) ?? voices[0] ?? null;
  };
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);

  function render() {
    const done = blocks.slice(0, index).reduce((n, b) => n + words(b.text), 0);
    const pct = Math.round((done / totalWords) * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
    status.textContent = playing ? `${minutes(totalWords - done)} min left` : index ? `Paused · ${minutes(totalWords - done)} min left` : `${minutes(totalWords)} min listen`;
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Listen to this article');
    playButton.dataset.state = playing ? 'playing' : 'paused';
    speedButton.textContent = `${speed}x`;
  }

  function highlight(el) {
    article.querySelectorAll('.is-speaking').forEach((n) => n.classList.remove('is-speaking'));
    if (!el) return;
    el.classList.add('is-speaking');
    const box = el.getBoundingClientRect();
    if (box.top < 80 || box.bottom > window.innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function speakCurrent() {
    if (index >= blocks.length) {
      playing = false;
      index = 0;
      highlight(null);
      return render();
    }
    const { el, text } = blocks[index];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (!playing) return;
      index += 1;
      render();
      speakCurrent();
    };
    highlight(el);
    synth.speak(utterance);
  }

  function play() {
    playing = true;
    synth.cancel();
    render();
    speakCurrent();
  }

  function pause() {
    playing = false;
    synth.cancel();
    render();
  }

  playButton.addEventListener('click', () => (playing ? pause() : play()));
  speedButton.addEventListener('click', () => {
    speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    if (playing) play();
    else render();
  });
  window.addEventListener('pagehide', () => synth.cancel());

  render();
  player.hidden = false;
})();

// "Summarize with AI": Gemini cannot take a prompt in its link, so copy the prompt before opening it.
document.querySelectorAll('[data-copy-prompt]').forEach((link) => {
  link.addEventListener('click', () => {
    navigator.clipboard?.writeText(link.dataset.copyPrompt).catch(() => {});
    const note = document.querySelector('[data-summarize-note]');
    if (note) note.textContent = 'Prompt copied. Paste it into Gemini.';
  });
});
