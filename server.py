#!/usr/bin/env python3
"""Servidor local com proxy para a API da Caixa (evita bloqueio de CORS)."""

import http.server
import os
import urllib.error
import urllib.request

API_BASE = "https://servicebus2.caixa.gov.br/portaldeloterias/api/"
ALLOWED_GAMES = {"megasena", "quina", "lotofacil"}
PORT = 8080


class LotteryHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/"):
            api_path = self.path.split("/api/", 1)[1].split("?", 1)[0].strip("/")
            game = api_path.split("/", 1)[0]
            if game not in ALLOWED_GAMES:
                self.send_error(404, "Jogo não suportado")
                return

            try:
                with urllib.request.urlopen(f"{API_BASE}{api_path}", timeout=15) as response:
                    payload = response.read()
            except urllib.error.URLError as exc:
                self.send_error(502, f"Erro ao consultar a Caixa: {exc.reason}")
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(payload)
            return

        return super().do_GET()


if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)
    server = http.server.HTTPServer(("", PORT), LotteryHandler)
    print(f"Servidor em http://localhost:{PORT}")
    print("Pressione Ctrl+C para encerrar.")
    server.serve_forever()