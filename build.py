"""Build static assets for Netlify and inject the public Render API URL."""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "dist"
PUBLIC_FILES = ("index.html", "style.css", "app.js", "api-client.js")


def main() -> None:
    api_base_url = os.environ.get("EMAPA_API_BASE_URL", "").strip().rstrip("/")
    if api_base_url:
        parsed = urlparse(api_base_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.path:
            raise SystemExit("EMAPA_API_BASE_URL debe ser la URL HTTPS raíz del Web Service de Render, sin ruta final.")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    for filename in PUBLIC_FILES:
        shutil.copy2(ROOT / filename, OUTPUT / filename)
    (OUTPUT / "emapa-config.js").write_text(
        "// Generado por build.py; la URL del API es pública.\n"
        f"window.EMAPA_API_BASE_URL = {json.dumps(api_base_url)};\n",
        encoding="utf-8",
    )
    (OUTPUT / "_redirects").write_text(
        "/login /index.html 200\n"
        "/admin-inventarios /index.html 200\n",
        encoding="utf-8",
    )
    print(f"Frontend listo en {OUTPUT}")
    if api_base_url:
        print(f"API Render configurada: {api_base_url}")
    else:
        print("AVISO: EMAPA_API_BASE_URL está vacía; el frontend intentará conectar al mismo origen.")


if __name__ == "__main__":
    main()
