const CAIXA_API = "https://servicebus2.caixa.gov.br/portaldeloterias/api";

const GAME_CONFIGS = {
  lotofacil: {
    api: "lotofacil",
    name: "Lotofácil",
    numbersPerGame: 15,
    minNumber: 1,
    maxNumber: 25,
    minAcertos: 11,
    officialUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx",
    officialLabel: "Site Oficial da Lotofácil - CAIXA",
    gamesLabel: "Seus Jogos de 15 números (um por linha)",
    placeholder: "01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15",
    concursoPlaceholder: "ex: 3529",
    betCost: 3.5,
  },
  quina: {
    api: "quina",
    name: "Quina",
    numbersPerGame: 5,
    minNumber: 1,
    maxNumber: 80,
    minAcertos: 2,
    officialUrl: "https://loterias.caixa.gov.br/Paginas/Quina.aspx",
    officialLabel: "Site Oficial da Quina - CAIXA",
    gamesLabel: "Seus Jogos de 5 números (um por linha)",
    placeholder: "01, 15, 23, 45, 67",
    concursoPlaceholder: "ex: 7000",
    betCost: 3,
  },
  "mega-sena": {
    api: "megasena",
    name: "Mega-Sena",
    numbersPerGame: 6,
    minNumber: 1,
    maxNumber: 60,
    minAcertos: 4,
    officialUrl: "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx",
    officialLabel: "Site Oficial da Mega-Sena - CAIXA",
    gamesLabel: "Seus Jogos de 6 números (um por linha)",
    placeholder: "05, 12, 23, 34, 45, 56",
    concursoPlaceholder: "ex: 3000",
    betCost: 6,
  },
};

const gameKey = document.body.dataset.game;
const config = GAME_CONFIGS[gameKey];

const concursoInput = document.getElementById("concurso-input");
const jogosInput = document.getElementById("jogos-input");
const verifyBtn = document.getElementById("verify-btn");
const resultsEl = document.getElementById("results");
const contestsList = document.getElementById("contests-list");
const contestsToggle = document.getElementById("contests-toggle");

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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Falha ao buscar dados");
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatNumbersList(numbers) {
  return numbers
    .map((n) => String(n).padStart(2, "0"))
    .join(", ");
}

function parsePrizeMap(listaRateioPremio) {
  const prizeMap = {};

  for (const tier of listaRateioPremio) {
    const match = tier.descricaoFaixa.match(/(\d+)\s*acertos/i);
    if (match) {
      prizeMap[parseInt(match[1], 10)] = tier.valorPremio;
    }
  }

  return prizeMap;
}

function parseGamesFromText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const games = [];

  for (let i = 0; i < lines.length; i++) {
    const numbers = lines[i]
      .split(/[,;\s]+/)
      .map((n) => parseInt(n.trim(), 10))
      .filter(
        (n) =>
          !Number.isNaN(n) &&
          n >= config.minNumber &&
          n <= config.maxNumber
      );

    const unique = [...new Set(numbers)].sort((a, b) => a - b);

    games.push({
      line: i + 1,
      numbers: unique,
      raw: lines[i],
    });
  }

  return games;
}

function countMatches(gameNumbers, drawnNumbers) {
  const drawnSet = new Set(drawnNumbers);
  return gameNumbers.filter((n) => drawnSet.has(n)).length;
}

function isWinner(hits, prizeMap) {
  return hits >= config.minAcertos && prizeMap[hits] > 0;
}

function renderContestsList(contests) {
  contestsList.innerHTML = contests
    .map(
      (contest) => `
        <li class="contests-list__item">
          <button
            class="contests-list__btn"
            type="button"
            data-concurso="${contest.numero}"
          >
            Concurso ${contest.numero} (${contest.dataApuracao})
          </button>
        </li>
      `
    )
    .join("");

  contestsList.querySelectorAll(".contests-list__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      concursoInput.value = btn.dataset.concurso;
      concursoInput.focus();
    });
  });
}

async function loadLastContests() {
  try {
    const latest = await fetchFromCaixa(config.api);
    const requests = [];

    for (let i = 0; i < 10; i++) {
      requests.push(fetchFromCaixa(`${config.api}/${latest.numero - i}`));
    }

    const contests = await Promise.all(requests);
    renderContestsList(contests);
  } catch {
    contestsList.innerHTML =
      '<li class="contests-list__error">Não foi possível carregar os concursos.</li>';
  }
}

function renderInvestmentSummary(totalGames, totalPrize) {
  if (!config.betCost) return "";

  const invested = totalGames * config.betCost;
  const won = totalPrize;
  const diff = Math.abs(won - invested);

  let resultLine = "";
  let resultClass = "";

  if (won > invested) {
    resultLine = `Lucro de ${formatCurrency(diff)}`;
    resultClass = "investment-summary__result--profit";
  } else if (won < invested) {
    resultLine = `Perda de ${formatCurrency(diff)}`;
    resultClass = "investment-summary__result--loss";
  } else {
    resultLine = `Lucro de ${formatCurrency(0)}`;
    resultClass = "investment-summary__result--profit";
  }

  return `
    <div class="investment-summary">
      <p class="investment-summary__row">
        <span>Valor investido:</span>
        <strong>${formatCurrency(invested)}</strong>
      </p>
      <p class="investment-summary__row">
        <span>Valor sorteado:</span>
        <strong>${formatCurrency(won)}</strong>
      </p>
      <p class="investment-summary__result ${resultClass}">${resultLine}</p>
    </div>
  `;
}

function renderResults(totalGames, winners, totalPrize) {
  const investmentSummary = renderInvestmentSummary(totalGames, totalPrize);

  const rows = winners
    .map(
      (item) => `
        <tr>
          <td>${item.line}</td>
          <td>${formatNumbersList(item.numbers)}</td>
          <td>${item.hits} acertos</td>
          <td>${formatCurrency(item.prize)}</td>
        </tr>
      `
    )
    .join("");

  const emptyMessage =
    winners.length === 0
      ? `<p class="results-empty">
          Nenhum jogo premiado neste concurso. É necessário acertar pelo menos ${config.minAcertos} números.
        </p>`
      : "";

  const tableSection =
    winners.length > 0
      ? `
        <div class="results-table-wrap">
          <table class="results-table">
            <thead>
              <tr>
                <th>Linha</th>
                <th>Seus Números</th>
                <th>Acertos</th>
                <th>Prêmio (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `
      : "";

  const totalBar = config.betCost
    ? ""
    : `<div class="results-total-bar">Total: ${formatCurrency(totalPrize)}</div>`;

  resultsEl.innerHTML = `
    <h2 class="results-title">
      SEUS RESULTADOS (${winners.length}) DE ${totalGames} JOGOS – ${winners.length} PREMIADOS
    </h2>
    ${investmentSummary}
    ${totalBar}
    ${emptyMessage}
    ${tableSection}
  `;

  resultsEl.classList.remove("hidden");
}

function showResultsError(message) {
  resultsEl.innerHTML = `<p class="results-error">${message}</p>`;
  resultsEl.classList.remove("hidden");
}

async function handleVerify() {
  const concurso = parseInt(concursoInput.value, 10);
  const games = parseGamesFromText(jogosInput.value);

  if (!concurso || concurso < 1) {
    showResultsError("Informe um número de concurso válido.");
    return;
  }

  if (games.length === 0) {
    showResultsError(
      `Informe pelo menos um jogo com números válidos (${config.minNumber} a ${config.maxNumber}).`
    );
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verificando...";
  resultsEl.classList.add("hidden");

  try {
    const draw = await fetchFromCaixa(`${config.api}/${concurso}`);
    const drawnNumbers = draw.listaDezenas.map((n) => parseInt(n, 10));
    const prizeMap = parsePrizeMap(draw.listaRateioPremio);

    const winners = [];

    for (const game of games) {
      const hits = countMatches(game.numbers, drawnNumbers);

      if (isWinner(hits, prizeMap)) {
        winners.push({
          line: game.line,
          numbers: game.numbers,
          hits,
          prize: prizeMap[hits],
        });
      }
    }

    const totalPrize = winners.reduce((sum, item) => sum + item.prize, 0);
    renderResults(games.length, winners, totalPrize);
  } catch {
    showResultsError(
      "Não foi possível verificar o concurso. Confira o número informado e tente novamente."
    );
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verificar Premiação";
  }
}

function init() {
  if (!config) {
    document.body.innerHTML =
      '<main class="verify-game-page"><p class="results-error">Jogo não suportado.</p></main>';
    return;
  }

  document.title = `Verificar ${config.name}`;

  contestsToggle.addEventListener("click", () => {
    const isExpanded = contestsToggle.getAttribute("aria-expanded") === "true";
    contestsToggle.setAttribute("aria-expanded", String(!isExpanded));
    contestsList.classList.toggle("hidden", isExpanded);
  });

  verifyBtn.addEventListener("click", handleVerify);
  loadLastContests();
}

init();