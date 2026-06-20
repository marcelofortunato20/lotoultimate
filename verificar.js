const GAMES = {
  "mega-sena": "Mega-Sena",
  quina: "Quina",
  lotofacil: "Lotofácil",
};

const params = new URLSearchParams(window.location.search);
const selectedGame = params.get("jogo");

const VERIFY_PAGES = {
  lotofacil: "verificar-lotofacil.html",
  quina: "verificar-quina.html",
  "mega-sena": "verificar-mega-sena.html",
};

document.querySelectorAll(".game-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const game = btn.dataset.game;
    const page = VERIFY_PAGES[game];

    if (page) {
      window.location.href = page;
      return;
    }

    window.location.href = `verificar.html?jogo=${game}`;
  });
});

if (selectedGame && GAMES[selectedGame]) {
  document.title = `Verificar Jogos — ${GAMES[selectedGame]}`;
}