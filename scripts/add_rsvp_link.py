#!/usr/bin/env python3
"""
Adiciona o link clicável de RSVP sobre o botão "CONFIRMAR PRESENÇA (RSVP)"
já desenhado no PDF de convite (docs/assets/convite_base.pdf),
sem alterar nada do visual do convite.

Uso:
    # Convite genérico (um único PDF, link igual para todo mundo)
    python3 scripts/add_rsvp_link.py

    # Convites individuais, um PDF por convidado, cada um com link próprio
    python3 scripts/add_rsvp_link.py --guests scripts/convidados.csv

O CSV de convidados deve ter as colunas: nome,max_convidados
"""

import argparse
import csv
import os
import re
import unicodedata
from urllib.parse import urlencode

import fitz

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(BASE_DIR)
SOURCE_PDF = os.path.join(REPO_DIR, "docs", "assets", "convite_base.pdf")
OUTPUT_DIR = os.path.join(REPO_DIR, "output")

RSVP_BASE_URL = "https://leandro-anestesia.github.io/rsvpihera/"

# Coordenadas (em pontos, origem no topo-esquerdo da página) do botão
# "CONFIRMAR PRESENÇA (RSVP)" detectadas no PDF original, com uma
# pequena margem extra para facilitar o toque.
BUTTON_RECT = fitz.Rect(155, 663, 440, 707)

# Também deixa clicável a legenda "* Clique no botão acima..." logo abaixo.
CAPTION_RECT = fitz.Rect(140, 710, 455, 730)


def slugify(name):
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or "convidado"


def build_rsvp_url(base_url, nome=None, max_convidados=None):
    if not nome:
        return base_url
    params = {"nome": nome}
    if max_convidados:
        params["max"] = str(max_convidados)
    return f"{base_url}?{urlencode(params)}"


def add_link(input_path, output_path, url):
    doc = fitz.open(input_path)
    page = doc[0]

    # O PDF original (exportado de outra ferramenta) trazia um link do tipo
    # "abrir arquivo local" apontando para um caminho que só existe na máquina
    # de quem criou o convite. Isso não funciona para os convidados e pode
    # disparar avisos de segurança no leitor de PDF, então removemos antes
    # de inserir o link de RSVP de verdade.
    for link in page.get_links():
        if link.get("kind") != fitz.LINK_URI:
            page.delete_link(link)

    page.insert_link({"kind": fitz.LINK_URI, "from": BUTTON_RECT, "uri": url})
    page.insert_link({"kind": fitz.LINK_URI, "from": CAPTION_RECT, "uri": url})
    doc.save(output_path)
    doc.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--guests",
        help="CSV com colunas nome,max_convidados para gerar um PDF individual por convidado",
    )
    parser.add_argument(
        "--base-url",
        default=RSVP_BASE_URL,
        help="URL base da página de RSVP (padrão: %(default)s)",
    )
    parser.add_argument(
        "--source",
        default=SOURCE_PDF,
        help="PDF de origem do convite (padrão: %(default)s)",
    )
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if args.guests:
        with open(args.guests, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                nome = row["nome"].strip()
                max_convidados = row.get("max_convidados", "").strip() or "1"
                url = build_rsvp_url(args.base_url, nome, max_convidados)
                filename = f"convite-{slugify(nome)}.pdf"
                out_path = os.path.join(OUTPUT_DIR, filename)
                add_link(args.source, out_path, url)
                print(f"Gerado: {filename}  ->  {url}")
                count += 1
        print(f"\n{count} convite(s) individuais gerados em {OUTPUT_DIR}/")
    else:
        out_path = os.path.join(OUTPUT_DIR, "convite-instituto-hera.pdf")
        url = build_rsvp_url(args.base_url)
        add_link(args.source, out_path, url)
        print(f"Gerado: {out_path}\nLink de RSVP: {url}")


if __name__ == "__main__":
    main()
