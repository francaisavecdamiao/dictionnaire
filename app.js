const bookDiv = document.getElementById('book');
const searchInput = document.getElementById('search-input');
const alphabetIndexDiv = document.getElementById('alphabet-index');
const pagerDiv = document.getElementById('pager');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageLabel = document.getElementById('page-label');

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const pronoms = ["Je", "Tu", "Il/Elle/On", "Nous", "Vous", "Ils/Elles"];

/* ---------- CONFIGURAÇÃO DA PAGINAÇÃO ---------- */
const MIN_ROWS = 6;        // mínimo de vocábulos por coluna
const MAX_ROWS = 8;        // máximo de vocábulos por coluna
const CARD_MIN_H = 84;     // altura ideal de cada card (px)
const GAP = 8;             // espaço vertical entre cards (px)
const PAGE_PAD_V = 24;     // padding vertical da .page (12 + 12)
const SWIPE_MIN = 50;      // distância mínima do deslize (px)

let currentList = [];      // lista atual (dicionário completo ou resultados da busca)
let currentPage = 0;
let rowsPerCol = MAX_ROWS;
let perPage = MAX_ROWS * 2;
let compact = false;
let view = 'list';         // 'list' | 'verb'
let animating = false;
let currentEl = null;
let swapToken = 0;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function init() {
  currentList = dicionario;
  renderAlphabet();
  measureLayout();
  showPage(0, 0);

  searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value.toLowerCase().trim());
  });

  // Botão "Conjugar" dentro dos cards (delegação de evento)
  bookDiv.addEventListener('click', (e) => {
    const btn = e.target.closest('.verb-btn[data-verb]');
    if (btn) renderVerbConjugation(btn.dataset.verb);
  });

  // Índice A-Z
  alphabetIndexDiv.addEventListener('click', (e) => {
    const el = e.target.closest('.alpha-letter');
    if (el) filterByLetter(el.dataset.letter);
  });

  // Teclado (← →), sem atrapalhar a digitação na busca
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === searchInput) return;
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'ArrowLeft') prevPage();
  });

  // Deslizar o dedo (touch)
  let touchX = 0, touchY = 0;
  bookDiv.addEventListener('touchstart', (e) => {
    touchX = e.changedTouches[0].clientX;
    touchY = e.changedTouches[0].clientY;
  }, { passive: true });
  bookDiv.addEventListener('touchend', (e) => {
    if (view !== 'list') return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) nextPage(); else prevPage();
  }, { passive: true });

  // Recalcula as linhas por coluna quando a tela muda de tamanho
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleResize, 150);
  });
}

function handleResize() {
  const before = `${rowsPerCol}|${compact}`;
  const firstIndex = currentPage * perPage; // mantém o mesmo vocábulo em vista
  measureLayout();
  if (before === `${rowsPerCol}|${compact}`) return;
  if (view === 'list' && !animating) {
    showPage(Math.floor(firstIndex / perPage), 0);
  }
}

/* Define quantos vocábulos cabem por coluna (entre 6 e 8) conforme a altura da tela */
function measureLayout() {
  const h = bookDiv.clientHeight - PAGE_PAD_V;
  let rows = Math.floor((h + GAP) / (CARD_MIN_H + GAP));
  rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, rows));
  const rowH = (h - GAP * (rows - 1)) / rows;
  rowsPerCol = rows;
  perPage = rows * 2;
  compact = rowH < 80;
}

function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- ÍNDICE A-Z ---------- */
function renderAlphabet() {
  const available = new Set(
    dicionario.map(item => normalizeString(item.fr).charAt(0).toUpperCase())
  );
  alphabetIndexDiv.innerHTML = alphabet.map(letter =>
    `<span class="alpha-letter${available.has(letter) ? '' : ' empty'}" data-letter="${letter}">${letter}</span>`
  ).join('');
}

function updateActiveLetter() {
  let active = '';
  if (view === 'list') {
    const first = currentList[currentPage * perPage];
    if (first) active = normalizeString(first.fr).charAt(0).toUpperCase();
  }
  alphabetIndexDiv.querySelectorAll('.alpha-letter').forEach(el => {
    el.classList.toggle('active', el.dataset.letter === active);
  });
}

// Pula direto para a página onde começam as palavras da letra
function filterByLetter(letter) {
  const wasFullList = view === 'list' && currentList === dicionario;
  searchInput.value = '';
  currentList = dicionario;

  const idx = dicionario.findIndex(item =>
    normalizeString(item.fr).startsWith(letter.toLowerCase())
  );
  if (idx < 0) return;

  const page = Math.floor(idx / perPage);
  if (wasFullList && page === currentPage) return;

  const dir = wasFullList ? (page > currentPage ? 1 : -1) : 1;
  showPage(page, dir);
}

/* ---------- BUSCA ---------- */
function handleSearch(query) {
  const wasVerb = view === 'verb';

  if (query === "") {
    currentList = dicionario;
    showPage(0, wasVerb ? -1 : 0);
    return;
  }

  const q = normalizeString(query);

  currentList = dicionario.filter(item =>
    normalizeString(item.fr).includes(q) ||
    normalizeString(item.pt).includes(q)
  );
  currentPage = 0;

  // Se a busca for exatamente uma conjugação em francês, abre a tabela do verbo
  let foundVerb = null;
  for (const verb in conjugacoes) {
    if (conjugacoes[verb].some(v => normalizeString(v) === q)) {
      foundVerb = verb;
      break;
    }
  }
  if (foundVerb) {
    renderVerbConjugation(foundVerb);
    return;
  }

  showPage(0, wasVerb ? -1 : 0);
}

/* ---------- PÁGINAS DO DICIONÁRIO ---------- */
function totalPages() {
  return Math.max(1, Math.ceil(currentList.length / perPage));
}

function cardHTML(item) {
  const hasConj = item.isVerb && conjugacoes[item.fr];
  const btn = hasConj
    ? `<button class="verb-btn" data-verb="${esc(item.fr)}">Conjugar</button>`
    : '';
  return `
    <div class="dict-card">
      <div class="dict-fr">${esc(item.fr)}</div>
      <div class="dict-meta">
        <span class="dict-type">${esc(item.type)}</span>
        ${btn}
      </div>
      <div class="dict-pt">${esc(item.pt)}</div>
    </div>
  `;
}

function buildListPage(pageIdx) {
  const el = document.createElement('div');
  el.className = 'page' + (compact ? ' compact' : '');

  const start = pageIdx * perPage;
  const items = currentList.slice(start, start + perPage);

  if (items.length === 0) {
    el.innerHTML = `<p class="empty-msg">Nenhuma palavra encontrada.</p>`;
    return el;
  }

  el.innerHTML = `
    <div class="page-grid" style="grid-template-rows: repeat(${rowsPerCol}, minmax(0, 1fr));">
      ${items.map(cardHTML).join('')}
    </div>
  `;
  return el;
}

// dir: 1 = avança (página atual vira), -1 = volta (página anterior cai por cima), 0 = sem animação
function showPage(idx, dir = 0) {
  idx = Math.max(0, Math.min(totalPages() - 1, idx));
  currentPage = idx;
  view = 'list';
  swapPage(buildListPage(idx), dir);
  updatePager();
  updateActiveLetter();
}

function nextPage() {
  if (animating || view !== 'list' || currentPage >= totalPages() - 1) return;
  showPage(currentPage + 1, 1);
}

function prevPage() {
  if (animating || view !== 'list' || currentPage <= 0) return;
  showPage(currentPage - 1, -1);
}

function updatePager() {
  const total = totalPages();
  pagerDiv.classList.toggle('hidden', view !== 'list');
  pageLabel.textContent = `${currentPage + 1} / ${total}`;
  prevBtn.disabled = currentPage <= 0;
  nextBtn.disabled = currentPage >= total - 1;
}

/* ---------- ANIMAÇÃO DE VIRAR PÁGINA ---------- */
function swapPage(newEl, dir) {
  const old = currentEl;
  // limpa páginas soltas caso uma animação anterior tenha sido interrompida
  [...bookDiv.children].forEach(c => { if (c !== old) c.remove(); });
  currentEl = newEl;
  const token = ++swapToken;

  if (!old || dir === 0 || reduceMotion.matches) {
    if (old) old.remove();
    bookDiv.appendChild(newEl);
    animating = false;
    return;
  }

  animating = true;
  let flipper;
  if (dir > 0) {
    // a página atual vira para a esquerda, revelando a nova por baixo
    newEl.classList.add('under');
    bookDiv.insertBefore(newEl, old);
    old.classList.add('flip-out');
    flipper = old;
  } else {
    // a página anterior volta virando por cima da atual
    bookDiv.appendChild(newEl);
    newEl.classList.add('flip-in');
    flipper = newEl;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    old.remove();
    newEl.classList.remove('under', 'flip-in');
    if (token === swapToken) animating = false;
  };
  flipper.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 700);
}

/* ---------- CONJUGAÇÃO ---------- */
function renderVerbConjugation(verbFr) {
  const conj = conjugacoes[verbFr];
  const conjPt = conjugacoesPt[verbFr];
  if (!conj) return;

  const itemInfo = dicionario.find(i => i.fr === verbFr);
  const translation = itemInfo ? itemInfo.pt : '';

  const rows = pronoms.map((pronom, index) => `
    <div class="conjugation-row" onclick="toggleTranslation(this)">
      <div class="conj-main">
        <span class="conj-pronoun">${pronom}</span>
        <span class="conj-verb">${esc(conj[index])}</span>
      </div>
      <div class="conj-translation" style="display: none;">
        ${conjPt ? esc(conjPt[index]) : 'Tradução indisponível'}
      </div>
    </div>
  `).join('');

  const el = document.createElement('div');
  el.className = 'page page-scroll';
  el.innerHTML = `
    <div class="verb-table-container">
      <div class="verb-table-header">${esc(verbFr)}</div>
      <p style="text-align:center; color: var(--text-light); font-weight:700; font-size:14px; margin-top:-10px; margin-bottom:5px;">${esc(translation)}</p>
      <p style="text-align:center; color: var(--laranja-salmao); font-size:11px; margin-bottom:15px; font-weight: 800; text-transform: uppercase;">(Clique na conjugação para traduzir)</p>
      ${rows}
    </div>
    <button class="verb-btn verb-back" onclick="backToList()">⬅ Voltar ao Dicionário</button>
  `;

  view = 'verb';
  swapPage(el, 1);
  updatePager();
  updateActiveLetter();
}

function toggleTranslation(element) {
  const transDiv = element.querySelector('.conj-translation');
  transDiv.style.display = transDiv.style.display === 'none' ? 'block' : 'none';
}

// Volta para a mesma página da lista em que o usuário estava
function backToList() {
  if (animating) return;
  showPage(currentPage, -1);
}

function renderHome() {
  if (animating) return;
  if (view === 'list' && currentList === dicionario && currentPage === 0 && !searchInput.value) return;
  searchInput.value = '';
  currentList = dicionario;
  showPage(0, -1);
}

window.onload = () => { init(); };
