const GAMES = {
  "mega-sena": { api: "megasena", name: "Mega-Sena" },
  quina: { api: "quina", name: "Quina" },
  lotofacil: { api: "lotofacil", name: "Lotofácil" },
};

const GAMES_WITH_GENERATOR = new Set(["mega-sena", "quina", "lotofacil"]);

const CAIXA_API = "https://servicebus2.caixa.gov.br/portaldeloterias/api";

const params = new URLSearchParams(window.location.search);
const gameKey = params.get("jogo");
const game = GAMES[gameKey];

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const contentEl = document.getElementById("result-content");

let currentDrawData = null;
let lastGeneratedGames = [];

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatWinners(count, prize) {
  if (count === 0) {
    return "Não houve ganhadores";
  }

  const label = count === 1 ? "aposta ganhadora" : "apostas ganhadoras";
  return `${count.toLocaleString("pt-BR")} ${label}, ${formatCurrency(prize)}`;
}

function getStatusText(data) {
  const topTier = data.listaRateioPremio?.[0];
  if (!topTier) return "";

  if (topTier.numeroDeGanhadores === 0) {
    return data.acumulado ? "Acumulou!" : "Não houve ganhadores";
  }

  const winners =
    topTier.numeroDeGanhadores === 1
      ? "1 ganhador"
      : `${topTier.numeroDeGanhadores.toLocaleString("pt-BR")} ganhadores`;

  return `${winners} na faixa principal!`;
}

async function fetchFromCaixa(apiPath) {
  const directUrl = `${CAIXA_API}/${apiPath}`;
  const sources = [
    `api/${apiPath}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
    directUrl,
  ];

  let lastError = null;

  for (const url of sources) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Falha ao buscar resultado");
}

async function fetchLastDraws(apiName, currentNumber, count) {
  const requests = [];

  for (let i = 0; i < count; i++) {
    requests.push(fetchFromCaixa(`${apiName}/${currentNumber - i}`));
  }

  return Promise.all(requests);
}

function renderNumbersRow(numbers, options = {}) {
  const { small = false, lotofacil = false, singleLine = false } = options;
  const ballClass = small ? " number-ball--small" : "";
  const rowClasses = ["result-numbers"];

  if (lotofacil) rowClasses.push("result-numbers--lotofacil");
  if (small) rowClasses.push("result-numbers--compact");
  if (singleLine) rowClasses.push("result-numbers--single-line");

  const balls = numbers
    .map((n) => `<span class="number-ball${ballClass}">${n}</span>`)
    .join("");

  return `<div class="${rowClasses.join(" ")}">${balls}</div>`;
}

function formatGamesForCopy(games) {
  return games
    .map((game) => formatGameNumbers(game).join(", "))
    .join("\n");
}

async function copyGeneratedGames() {
  if (lastGeneratedGames.length === 0) return;

  const text = formatGamesForCopy(lastGeneratedGames);
  const btn = document.getElementById("copy-games-btn");

  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copiado!";
    btn.classList.add("copy-games-btn--success");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    btn.textContent = "Copiado!";
    btn.classList.add("copy-games-btn--success");
  }

  setTimeout(() => {
    btn.textContent = "Copiar Números";
    btn.classList.remove("copy-games-btn--success");
  }, 2000);
}

function bindCopyButton() {
  const copyBtn = document.getElementById("copy-games-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyGeneratedGames);
  }
}

function renderGeneratedGames(games, analysis, fromConcurso) {
  const isLotofacil = gameKey === "lotofacil";
  const useCompactList = games.length > 30;
  const gameRowClass = isLotofacil ? "generated-game generated-game--inline" : "generated-game";
  const listClass = useCompactList
    ? "generated-games__list generated-games__list--scroll"
    : "generated-games__list";

  const gamesHtml = useCompactList
    ? games
        .map(
          (game, index) => `
            <div class="generated-game generated-game--text">
              <span class="generated-game__label">Jogo ${index + 1}:</span>
              <span class="generated-game__numbers">${formatGameNumbers(game).join(", ")}</span>
            </div>
          `
        )
        .join("")
    : games
        .map(
          (game, index) => `
            <div class="${gameRowClass}">
              <span class="generated-game__label">Jogo ${index + 1}</span>
              ${renderNumbersRow(formatGameNumbers(game), {
                small: true,
                lotofacil: isLotofacil,
                singleLine: isLotofacil,
              })}
            </div>
          `
        )
        .join("");

  const oddPercent = Math.round(analysis.oddRatio * 100);
  const evenPercent = 100 - oddPercent;

  return `
    <section class="generated-games" id="generated-games">
      <div class="generated-games__header">
        <h2 class="premiacao-title">Jogos Sugeridos</h2>
        <button class="copy-games-btn" id="copy-games-btn" type="button">
          Copiar Números
        </button>
      </div>
      <p class="generated-games__info">
        Baseado na análise estatística dos últimos ${analysis.drawsAnalyzed} concursos
        (${fromConcurso - analysis.drawsAnalyzed + 1} a ${fromConcurso}).
        Números pouco frequentes foram excluídos. Distribuição ímpar/par observada:
        ${oddPercent}% ímpares e ${evenPercent}% pares.
      </p>
      <div class="${listClass}">
        ${gamesHtml}
      </div>
    </section>
  `;
}

function renderCreateGamesSection() {
  if (!GAMES_WITH_GENERATOR.has(gameKey)) return "";

  const hint = "Gera jogos com base nos últimos 10 concursos (você escolhe a quantidade)";

  return `
    <div class="result-actions">
      <button class="create-games-btn" id="create-games-btn" type="button">
        Criar Jogos
      </button>
      <p class="create-games-hint">${hint}</p>
    </div>
    <div id="games-output"></div>
  `;
}

function askGameQuantity() {
  return new Promise((resolve) => {
    const modal = document.getElementById("quantity-modal");
    const input = document.getElementById("quantity-input");
    const confirmBtn = document.getElementById("quantity-confirm");
    const cancelBtn = document.getElementById("quantity-cancel");
    const backdrop = document.getElementById("quantity-modal-backdrop");

    const close = (value) => {
      modal.classList.add("hidden");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onCancel);
      resolve(value);
    };

    const onConfirm = () => {
      const value = parseInt(input.value, 10);
      if (!value || value < 1) {
        input.focus();
        return;
      }
      close(Math.min(value, 1000));
    };

    const onCancel = () => close(null);

    input.value = "10";
    modal.classList.remove("hidden");
    input.focus();
    input.select();

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onCancel);

    input.onkeydown = (event) => {
      if (event.key === "Enter") onConfirm();
      if (event.key === "Escape") onCancel();
    };
  });
}

function renderResult(data) {
  currentDrawData = data;

  const numbersClass =
    gameKey === "lotofacil"
      ? "result-numbers result-numbers--lotofacil result-numbers--single-line"
      : "result-numbers";

  const numbersHtml = data.listaDezenas
    .map((n) => `<span class="number-ball">${n}</span>`)
    .join("");

  const premiacaoHtml = data.listaRateioPremio
    .map(
      (tier) => `
        <div class="premiacao-item">
          <p class="premiacao-item__faixa">${tier.descricaoFaixa}</p>
          <p class="premiacao-item__info">${formatWinners(tier.numeroDeGanhadores, tier.valorPremio)}</p>
        </div>
      `
    )
    .join("");

  contentEl.innerHTML = `
    <header class="result-header">
      <h1 class="result-header__title">Resultado</h1>
      <span class="result-header__info">Concurso ${data.numero} (${data.dataApuracao})</span>
    </header>

    <p class="result-status">${getStatusText(data)}</p>

    <p class="result-location">
      Sorteio realizado no ${data.localSorteio} em ${data.nomeMunicipioUFSorteio}
    </p>

    <div class="${numbersClass}">
      ${numbersHtml}
    </div>

    <section class="premiacao">
      <h2 class="premiacao-title">Premiação</h2>
      <div class="premiacao-list">
        ${premiacaoHtml}
      </div>
    </section>

    ${renderCreateGamesSection()}
  `;

  if (GAMES_WITH_GENERATOR.has(gameKey)) {
    document.getElementById("create-games-btn").addEventListener("click", handleCreateGames);
  }
}

async function handleCreateGames() {
  const btn = document.getElementById("create-games-btn");
  const output = document.getElementById("games-output");

  const chosen = await askGameQuantity();
  if (!chosen) return;
  const quantity = chosen;

  btn.disabled = true;
  btn.textContent = "Analisando concursos...";
  output.innerHTML = `<p class="generated-games__loading">Buscando os últimos 10 resultados...</p>`;

  try {
    const draws = await fetchLastDraws(game.api, currentDrawData.numero, 10);
    output.innerHTML = `<p class="generated-games__loading">Gerando ${quantity} jogos...</p>`;

    const { games, analysis } = generateLotteryGames(draws, gameKey, quantity);

    if (games.length < quantity) {
      output.innerHTML = `<p class="generated-games__error">Foram gerados apenas ${games.length} de ${quantity} jogos únicos. Tente uma quantidade menor.</p>`;
      btn.textContent = "Criar Jogos";
      btn.disabled = false;
      return;
    }

    lastGeneratedGames = games;
    output.innerHTML = renderGeneratedGames(games, analysis, currentDrawData.numero);
    bindCopyButton();
    btn.textContent = "Gerar Novamente";
    btn.disabled = false;
  } catch {
    output.innerHTML = `<p class="generated-games__error">Não foi possível gerar os jogos. Tente novamente.</p>`;
    btn.textContent = "Criar Jogos";
    btn.disabled = false;
  }
}

function showError(message) {
  loadingEl.classList.add("hidden");
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

async function init() {
  if (!game) {
    showError("Jogo não encontrado. Volte e selecione um jogo válido.");
    return;
  }

  document.title = `Resultado ${game.name}`;

  if (gameKey === "lotofacil") {
    document.querySelector(".result-page")?.classList.add("result-page--lotofacil");
    document.getElementById("result-card")?.classList.add("result-card--lotofacil");
    document.querySelectorAll(".back-link").forEach((link) => {
      link.classList.add("back-link--lotofacil");
    });
  }

  try {
    const data = await fetchFromCaixa(game.api);
    loadingEl.classList.add("hidden");
    renderResult(data);
    contentEl.classList.remove("hidden");
  } catch {
    showError(
      "Não foi possível carregar o resultado da Caixa. Verifique sua conexão e tente novamente."
    );
  }
}

init();