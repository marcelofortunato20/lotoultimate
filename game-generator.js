const HISTORY_DRAWS = 10;
const DEFAULT_GAMES_TO_CREATE = 10;

const GAME_CONFIGS = {
  "mega-sena": { totalNumbers: 60, numbersPerGame: 6 },
  quina: { totalNumbers: 80, numbersPerGame: 5 },
  lotofacil: { totalNumbers: 25, numbersPerGame: 15 },
};

function parseDrawNumbers(draw) {
  return draw.listaDezenas.map((n) => parseInt(n, 10));
}

function combinationCount(n, k) {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;

  let result = 1;
  const limit = Math.min(k, n - k);

  for (let i = 0; i < limit; i++) {
    result = (result * (n - i)) / (i + 1);
  }

  return Math.floor(result);
}

function countAvailableNumbers(totalNumbers, excluded) {
  let count = 0;

  for (let num = 1; num <= totalNumbers; num++) {
    if (!excluded.has(num)) count++;
  }

  return count;
}

function analyzeHistory(draws, totalNumbers, numbersPerGame, quantity = DEFAULT_GAMES_TO_CREATE) {
  const frequency = Array(totalNumbers + 1).fill(0);
  let totalOdd = 0;

  for (const numbers of draws) {
    for (const num of numbers) {
      frequency[num]++;
      if (num % 2 === 1) totalOdd++;
    }
  }

  const targetOdd = Math.round(totalOdd / draws.length);
  const excluded = new Set();

  for (let num = 1; num <= totalNumbers; num++) {
    if (frequency[num] === 0) {
      excluded.add(num);
    }
  }

  const appeared = [];
  for (let num = 1; num <= totalNumbers; num++) {
    if (!excluded.has(num)) {
      appeared.push({ num, frequency: frequency[num] });
    }
  }

  appeared.sort((a, b) => a.frequency - b.frequency);
  const minFrequency = appeared[0]?.frequency ?? 0;
  const strictExcluded = new Set(excluded);

  for (const item of appeared) {
    if (item.frequency === minFrequency && minFrequency <= 1) {
      strictExcluded.add(item.num);
    }
  }

  const strictPoolSize = countAvailableNumbers(totalNumbers, strictExcluded);
  const maxUniqueStrict = combinationCount(strictPoolSize, numbersPerGame);

  if (maxUniqueStrict >= quantity) {
    for (const num of strictExcluded) {
      excluded.add(num);
    }
  }

  const oddRatio = totalOdd / (draws.length * numbersPerGame);

  return {
    frequency,
    targetOdd: Math.min(numbersPerGame, Math.max(0, targetOdd)),
    excluded,
    oddRatio,
    drawsAnalyzed: draws.length,
    totalNumbers,
    numbersPerGame,
  };
}

function weightedPick(pool, count) {
  const available = [...pool];
  const selected = [];

  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < available.length; j++) {
      random -= available[j].weight;
      if (random <= 0) {
        selected.push(available[j].num);
        available.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}

function buildPool(frequency, excluded, preferOdd, totalNumbers) {
  const pool = [];

  for (let num = 1; num <= totalNumbers; num++) {
    if (excluded.has(num)) continue;

    const freq = frequency[num];
    const isOdd = num % 2 === 1;
    let weight = freq * freq;

    if (preferOdd === isOdd) {
      weight *= 1.35;
    }

    pool.push({ num, weight, isOdd });
  }

  return pool;
}

function generateSingleGame(analysis, gameIndex) {
  const { frequency, excluded, targetOdd, oddRatio, totalNumbers, numbersPerGame } = analysis;

  const preferOdd = oddRatio >= 0.5;
  const pool = buildPool(frequency, excluded, preferOdd, totalNumbers);

  const odds = pool.filter((item) => item.isOdd);
  const evens = pool.filter((item) => !item.isOdd);

  const variation = gameIndex % 3;
  const adjustedOddCount =
    variation === 1
      ? Math.min(odds.length, targetOdd + 1)
      : variation === 2
        ? Math.max(0, targetOdd - 1)
        : targetOdd;

  const adjustedEvenCount = numbersPerGame - adjustedOddCount;

  const selectedOdds = weightedPick(odds, Math.min(adjustedOddCount, odds.length));
  const selectedEvens = weightedPick(evens, Math.min(adjustedEvenCount, evens.length));

  let game = [...selectedOdds, ...selectedEvens];

  if (game.length < numbersPerGame) {
    const remaining = pool
      .filter((item) => !game.includes(item.num))
      .sort((a, b) => b.weight - a.weight);

    for (const item of remaining) {
      if (game.length >= numbersPerGame) break;
      game.push(item.num);
    }
  }

  return game.sort((a, b) => a - b).slice(0, numbersPerGame);
}

function generateLotteryGames(draws, gameKey, quantity = DEFAULT_GAMES_TO_CREATE) {
  const config = GAME_CONFIGS[gameKey];
  if (!config) {
    throw new Error("Jogo não suportado para geração");
  }

  const totalGames = Math.max(1, Math.floor(quantity));
  const parsedDraws = draws.map(parseDrawNumbers);
  const analysis = analyzeHistory(
    parsedDraws,
    config.totalNumbers,
    config.numbersPerGame,
    totalGames
  );
  const games = [];
  const usedKeys = new Set();
  let attempts = 0;
  const poolSize = countAvailableNumbers(config.totalNumbers, analysis.excluded);
  const maxUnique = combinationCount(poolSize, config.numbersPerGame);
  const maxAttempts = Math.max(2000, totalGames * 150, maxUnique * 3);

  while (games.length < totalGames && attempts < maxAttempts) {
    const game = generateSingleGame(analysis, games.length + attempts);
    const key = game.join("-");

    if (game.length === config.numbersPerGame && !usedKeys.has(key)) {
      usedKeys.add(key);
      games.push(game);
    }

    attempts++;
  }

  return { games, analysis };
}

function formatGameNumbers(numbers) {
  return numbers.map((n) => String(n).padStart(2, "0"));
}