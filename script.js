document.querySelectorAll(".game-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const game = btn.dataset.game;
    window.location.href = `resultado.html?jogo=${game}`;
  });
});