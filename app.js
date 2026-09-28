const contentDiv = document.getElementById('content');
const searchInput = document.getElementById('search-input');
const alphabetIndexDiv = document.getElementById('alphabet-index');

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const pronoms = ["Je", "Tu", "Il/Elle/On", "Nous", "Vous", "Ils/Elles"];

function init() {
  renderAlphabet();
  renderList(dicionario);

  searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value.toLowerCase().trim());
  });
}

function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renderAlphabet() {
  alphabetIndexDiv.innerHTML = alphabet.map(letter => 
    `<span class="alpha-letter" onclick="filterByLetter('${letter}')">${letter}</span>`
  ).join('');
}

function filterByLetter(letter) {
  triggerPageTurn();
  searchInput.value = ''; 
  const filtered = dicionario.filter(item => 
    normalizeString(item.fr).startsWith(letter.toLowerCase())
  );
  renderList(filtered, letter);
}

function handleSearch(query) {
  if (query === "") {
    renderList(dicionario);
    return;
  }

  // 1. Verifica se a busca é uma conjugação exata em francês (direciona para a tabela)
  let foundVerb = null;
  for (const verb in conjugacoes) {
    const conjArray = conjugacoes[verb].map(v => normalizeString(v));
    if (conjArray.includes(normalizeString(query)) || normalizeString(verb).includes(normalizeString(query))) {
      foundVerb = verb;
      break;
    }
  }

  triggerPageTurn();

  // Se achar conjugação exata, exibe a tabela do verbo
  if (foundVerb && conjugacoes[foundVerb].some(v => normalizeString(v) === normalizeString(query))) {
    renderVerbConjugation(foundVerb);
    return;
  }

  // 2. Busca normal no vocabulário (FR ou PT)
  const results = dicionario.filter(item => 
    normalizeString(item.fr).includes(query) || 
    normalizeString(item.pt).includes(query)
  );

  renderList(results);
}

function renderList(list, highlightLetter = null) {
  if (list.length === 0) {
    contentDiv.innerHTML = `<p style="text-align:center; color: var(--text-light); margin-top:20px;">Nenhuma palavra encontrada.</p>`;
    return;
  }

  let html = '';
  if (highlightLetter) {
    html += `<div class="letter-header">${highlightLetter}</div>`;
  }

  list.forEach(item => {
    let verbButton = item.isVerb && conjugacoes[item.fr] 
      ? `<button class="verb-btn" onclick="renderVerbConjugation('${item.fr}')">Ver Conjugação</button>` 
      : '';
      
    html += `
      <div class="dict-card">
        <div class="dict-fr">${item.fr}</div>
        <div class="dict-type">${item.type}</div>
        <div class="dict-pt">${item.pt}</div>
        ${verbButton}
      </div>
    `;
  });

  contentDiv.innerHTML = html;
}

function renderVerbConjugation(verbFr) {
  triggerPageTurn();
  const conj = conjugacoes[verbFr];
  if (!conj) return;

  const itemInfo = dicionario.find(i => i.fr === verbFr);
  const translation = itemInfo ? itemInfo.pt : '';

  let rows = pronoms.map((pronom, index) => `
    <div class="conjugation-row">
      <span class="conj-pronoun">${pronom}</span>
      <span class="conj-verb">${conj[index]}</span>
    </div>
  `).join('');

  contentDiv.innerHTML = `
    <div class="verb-table-container">
      <div class="verb-table-header">${verbFr}</div>
      <p style="text-align:center; color: var(--text-light); font-weight:700; font-size:14px; margin-top:-10px; margin-bottom:15px;">${translation}</p>
      ${rows}
    </div>
    <button class="verb-btn" style="width: 100%; font-size: 16px;" onclick="renderHome()">⬅ Voltar ao Dicionário</button>
  `;
}

function renderHome() {
  searchInput.value = '';
  triggerPageTurn();
  renderList(dicionario);
}

function triggerPageTurn() {
  contentDiv.classList.remove('page-turn-anim');
  void contentDiv.offsetWidth; // Reflow para reiniciar a animação CSS
  contentDiv.classList.add('page-turn-anim');
}

// Inicializa
window.onload = () => { init(); };
