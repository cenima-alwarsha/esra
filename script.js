const story = window.STORY_DATA;

const elements = {
  book: document.getElementById("book"),
  bookTitle: document.getElementById("bookTitle"),
  sceneMeta: document.getElementById("sceneMeta"),
  imagePage: document.getElementById("imagePage"),
  sceneImage: document.getElementById("sceneImage"),
  sceneTitle: document.getElementById("sceneTitle"),
  pageSource: document.getElementById("pageSource"),
  chunkSource: document.getElementById("chunkSource"),
  storyText: document.getElementById("storyText"),
  nextBtn: document.getElementById("nextBtn"),
  prevBtn: document.getElementById("prevBtn"),
  fontDownBtn: document.getElementById("fontDownBtn"),
  fontUpBtn: document.getElementById("fontUpBtn"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
};

const state = {
  index: clamp(readStoredNumber("isfahan-reader-index", 0), 0, story.spreads.length - 1),
  isTurning: false,
  fontMode: readStoredText("isfahan-reader-font", "normal"),
  pointerStart: null,
};

const arabicDigits = new Intl.NumberFormat("ar-EG", { useGrouping: false });

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toArabicNumber(value) {
  return arabicDigits.format(value);
}

function readStoredNumber(key, fallback) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readStoredText(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Private browsing can block storage; the reader should still work.
  }
}

function render() {
  const spread = story.spreads[state.index];
  const pageNumber = state.index + 1;
  const progress = (pageNumber / story.spreads.length) * 100;

  document.body.dataset.font = state.fontMode;
  elements.bookTitle.textContent = story.title;
  elements.imagePage.classList.remove("is-missing");
  elements.sceneImage.src = spread.image;
  elements.sceneImage.alt = spread.imageAlt;
  elements.sceneTitle.textContent = spread.sceneTitle;
  elements.pageSource.textContent = `صفحة ${toArabicNumber(spread.sourcePage)} من الأصل`;
  elements.chunkSource.textContent = `${toArabicNumber(spread.chunk)} / ${toArabicNumber(spread.chunks)}`;
  fillStoryText(elements.storyText, spread.text);
  elements.sceneMeta.textContent = `مشهد ${toArabicNumber(spread.sourcePage)} · قلبة ${toArabicNumber(pageNumber)}`;
  elements.progressText.textContent = `${toArabicNumber(pageNumber)} من ${toArabicNumber(story.spreads.length)}`;
  elements.progressFill.style.width = `${progress}%`;

  elements.nextBtn.disabled = state.index >= story.spreads.length - 1;
  elements.prevBtn.disabled = state.index <= 0;
  elements.fontDownBtn.disabled = state.fontMode === "small";
  elements.fontUpBtn.disabled = state.fontMode === "large";

  writeStored("isfahan-reader-index", state.index);
  writeStored("isfahan-reader-font", state.fontMode);
  preloadImage(state.index + 1);
  preloadImage(state.index - 1);
}

function preloadImage(index) {
  if (!story.spreads[index]) return;
  const image = new Image();
  image.src = story.spreads[index].image;
}

function splitStoryBlocks(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.!؟!؛]+[.!؟!؛]*/g) || [normalized];
  const blocks = [];
  let current = "";

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    const shouldStandAlone = isDialogueText(sentence) || sentence.length > 170;
    if (shouldStandAlone && current) {
      blocks.push(current);
      current = "";
    }

    if (shouldStandAlone) {
      blocks.push(sentence);
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > 155) {
      if (current) blocks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function isDialogueText(text) {
  return /["“”«»]/.test(text) || ["قال", "قلت", "صرخت", "سأل", "أجاب", "همس", "أكمل", "تابع"].some((word) => text.includes(word));
}

function blockType(text) {
  if (isDialogueText(text)) return "dialogue";
  if (["في داخلي", "شعرت", "تمنيت", "وجدت نفسي", "لم أستطع"].some((word) => text.includes(word))) return "inner";
  return "narrative";
}

function fillStoryText(container, text) {
  const fragment = document.createDocumentFragment();
  splitStoryBlocks(text).forEach((blockText) => {
    const block = document.createElement("p");
    block.className = `story-block story-block--${blockType(blockText)}`;
    block.textContent = blockText;
    fragment.append(block);
  });
  container.replaceChildren(fragment);
}

function makeTextFragment(spread) {
  const fragment = document.createElement("div");
  fragment.className = "turn-fragment turn-fragment--text";

  const mark = document.createElement("div");
  mark.className = "page-mark";

  const source = document.createElement("span");
  source.textContent = `صفحة ${toArabicNumber(spread.sourcePage)}`;

  const chunk = document.createElement("span");
  chunk.textContent = `${toArabicNumber(spread.chunk)} / ${toArabicNumber(spread.chunks)}`;

  const text = document.createElement("div");
  text.className = "story-text";
  fillStoryText(text, spread.text);

  mark.append(source, chunk);
  fragment.append(mark, text);
  return fragment;
}

function makeImageFragment(spread) {
  const fragment = document.createElement("div");
  fragment.className = "turn-fragment turn-fragment--image";

  const image = document.createElement("img");
  image.src = spread.image;
  image.alt = "";

  fragment.append(image);
  return fragment;
}

function buildTurnSheet(direction, currentSpread, targetSpread) {
  const sheet = document.createElement("div");
  sheet.className = `turn-sheet turn-sheet--${direction}`;

  const front = document.createElement("div");
  front.className = "turn-face turn-face--front";

  const back = document.createElement("div");
  back.className = "turn-face turn-face--back";

  if (direction === "next") {
    front.append(makeTextFragment(currentSpread));
    back.append(makeImageFragment(targetSpread));
  } else {
    front.append(makeImageFragment(currentSpread));
    back.append(makeTextFragment(targetSpread));
  }

  const shadow = document.createElement("div");
  shadow.className = "turn-shadow";

  sheet.append(front, back, shadow);
  return sheet;
}

function turn(direction) {
  if (state.isTurning) return;

  const delta = direction === "next" ? 1 : -1;
  const targetIndex = state.index + delta;
  if (!story.spreads[targetIndex]) return;

  state.isTurning = true;
  const sheet = buildTurnSheet(direction, story.spreads[state.index], story.spreads[targetIndex]);
  elements.book.append(sheet);

  window.setTimeout(() => {
    state.index = targetIndex;
    render();
    sheet.remove();
    state.isTurning = false;
  }, 680);
}

function setFontMode(delta) {
  const modes = ["small", "normal", "large"];
  const current = modes.indexOf(state.fontMode);
  state.fontMode = modes[clamp(current + delta, 0, modes.length - 1)];
  render();
}

function handlePointerStart(event) {
  state.pointerStart = {
    x: event.clientX,
    y: event.clientY,
    time: Date.now(),
  };
}

function handlePointerEnd(event) {
  if (!state.pointerStart) return;

  const dx = event.clientX - state.pointerStart.x;
  const dy = event.clientY - state.pointerStart.y;
  const elapsed = Date.now() - state.pointerStart.time;
  state.pointerStart = null;

  if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) && elapsed < 900) {
    turn(dx > 0 ? "next" : "prev");
    return;
  }

  const rect = elements.book.getBoundingClientRect();
  const tapX = event.clientX - rect.left;
  if (tapX > rect.width * 0.64) turn("next");
  if (tapX < rect.width * 0.36) turn("prev");
}

elements.nextBtn.addEventListener("click", () => turn("next"));
elements.prevBtn.addEventListener("click", () => turn("prev"));
elements.fontDownBtn.addEventListener("click", () => setFontMode(-1));
elements.fontUpBtn.addEventListener("click", () => setFontMode(1));
elements.book.addEventListener("pointerdown", handlePointerStart);
elements.book.addEventListener("pointerup", handlePointerEnd);
elements.book.addEventListener("pointercancel", () => {
  state.pointerStart = null;
});
elements.sceneImage.addEventListener("load", () => {
  elements.imagePage.classList.remove("is-missing");
});
elements.sceneImage.addEventListener("error", () => {
  elements.imagePage.classList.add("is-missing");
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") turn("next");
  if (event.key === "ArrowLeft") turn("prev");
  if (event.key === "+" || event.key === "=") setFontMode(1);
  if (event.key === "-") setFontMode(-1);
});

render();
