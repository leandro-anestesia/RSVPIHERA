#!/usr/bin/env python3
"""
Gera os convites em PDF da inauguração do Instituto Hera.

Uso:
    # Convite genérico (mesmo link de RSVP para todo mundo)
    python3 scripts/generate_invites.py

    # Convites individuais, um PDF por convidado, cada um com link próprio
    python3 scripts/generate_invites.py --guests scripts/convidados.csv

O CSV de convidados deve ter as colunas: nome,max_convidados
Exemplo:
    nome,max_convidados
    João Silva,2
    Maria Souza,1
"""

import argparse
import csv
import os
import re
import unicodedata
from urllib.parse import urlencode

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A5
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(BASE_DIR)
FONTS_DIR = os.path.join(BASE_DIR, "fonts")
ASSETS_DIR = os.path.join(REPO_DIR, "docs", "assets")
OUTPUT_DIR = os.path.join(REPO_DIR, "output")

RSVP_BASE_URL = "https://leandro-anestesia.github.io/rsvpihera/"

EVENT = {
    "eyebrow": "INAUGURAÇÃO",
    "title": "Instituto Hera",
    "subtitle": "Você está convidado(a) para conhecer o nosso novo espaço",
    "date": "Sábado, 12 de setembro de 2026",
    "time": "09h às 12h",
    "address": "Rua Quirino do Amaral Campos, 144 — sala 705, Cambuí",
}

# Paleta extraída da logo oficial do Instituto Hera
TEAL = HexColor("#31BBA2")
TEAL_DARK = HexColor("#1F8577")
MINT = HexColor("#A4D9CD")
MINT_LIGHT = HexColor("#EAF6F2")
LAVENDER = HexColor("#B88AB8")
PURPLE = HexColor("#8C2887")
PURPLE_DARK = HexColor("#5F1B5C")
INK = HexColor("#2B2530")
PAPER = HexColor("#FFFDF9")


def register_fonts():
    pdfmetrics.registerFont(TTFont("Playfair-Bold", os.path.join(FONTS_DIR, "PlayfairDisplay-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Playfair-SemiBold", os.path.join(FONTS_DIR, "PlayfairDisplay-SemiBold.ttf")))
    pdfmetrics.registerFont(TTFont("Jost", os.path.join(FONTS_DIR, "Jost-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Jost-Medium", os.path.join(FONTS_DIR, "Jost-Medium.ttf")))
    pdfmetrics.registerFont(TTFont("Jost-SemiBold", os.path.join(FONTS_DIR, "Jost-SemiBold.ttf")))
    pdfmetrics.registerFont(TTFont("Jost-Bold", os.path.join(FONTS_DIR, "Jost-Bold.ttf")))


def tracked(text, spacing=" "):
    """Adiciona espaçamento entre letras para efeito de tracking em maiúsculas."""
    return spacing.join(list(text))


def slugify(name):
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or "convidado"


def build_rsvp_url(nome=None, max_convidados=None):
    if not nome:
        return RSVP_BASE_URL
    params = {"nome": nome}
    if max_convidados:
        params["max"] = str(max_convidados)
    return f"{RSVP_BASE_URL}?{urlencode(params)}"


def draw_invite(c, width, height, rsvp_url):
    logo_path = os.path.join(ASSETS_DIR, "logo_hera_icon_print.png")

    # fundo
    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # halo decorativo atrás da logo
    c.saveState()
    c.setFillColor(MINT_LIGHT)
    c.circle(width / 2, height - 40, 150, fill=1, stroke=0)
    c.restoreState()

    # detalhes decorativos nos cantos (paleta da marca)
    c.saveState()
    c.setFillColor(LAVENDER)
    c.setFillAlpha(0.35)
    c.circle(18, height - 18, 26, fill=1, stroke=0)
    c.setFillColor(PURPLE)
    c.setFillAlpha(0.25)
    c.circle(width - 16, 26, 34, fill=1, stroke=0)
    c.restoreState()

    # logo
    logo_w = 92
    logo_h = logo_w * (900 / 711.0)  # aproximação de proporção original
    from PIL import Image as PILImage

    with PILImage.open(logo_path) as im:
        logo_h = logo_w * (im.height / im.width)
    c.drawImage(
        logo_path,
        (width - logo_w) / 2,
        height - 40 - logo_h + 25,
        width=logo_w,
        height=logo_h,
        mask="auto",
    )

    top_text_y = height - 40 - logo_h + 25 - 22

    # eyebrow
    c.setFont("Jost-SemiBold", 10.5)
    c.setFillColor(TEAL_DARK)
    c.drawCentredString(width / 2, top_text_y, tracked(EVENT["eyebrow"], "  "))

    # título
    c.setFont("Playfair-Bold", 30)
    c.setFillColor(PURPLE_DARK)
    c.drawCentredString(width / 2, top_text_y - 34, EVENT["title"])

    # subtítulo
    c.setFont("Jost", 11)
    c.setFillColor(INK)
    c.drawCentredString(width / 2, top_text_y - 54, EVENT["subtitle"])

    # divisor decorativo
    divider_y = top_text_y - 72
    c.setStrokeColor(MINT)
    c.setLineWidth(1.2)
    c.line(width / 2 - 60, divider_y, width / 2 - 12, divider_y)
    c.line(width / 2 + 12, divider_y, width / 2 + 60, divider_y)
    c.setFillColor(PURPLE)
    c.circle(width / 2, divider_y, 3, fill=1, stroke=0)

    # bloco de detalhes do evento
    details_top = divider_y - 34
    rows = [
        ("DATA", EVENT["date"]),
        ("HORÁRIO", EVENT["time"]),
        ("LOCAL", EVENT["address"]),
    ]
    row_y = details_top
    label_x = width / 2 - 118
    value_x = width / 2 - 48
    for label, value in rows:
        c.setFillColor(TEAL_DARK)
        c.setFont("Jost-SemiBold", 9.5)
        c.drawString(label_x, row_y, label)

        c.setFillColor(INK)
        c.setFont("Jost", 11)
        max_width = width / 2 + 118 - value_x
        lines = wrap_text(c, value, "Jost", 11, max_width)
        for i, line in enumerate(lines):
            c.drawString(value_x, row_y - (i * 13), line)
        row_y -= 24 + max(0, (len(lines) - 1)) * 13

    # botão de RSVP
    btn_w, btn_h = 220, 40
    btn_x = (width - btn_w) / 2
    btn_y = row_y - 30

    c.setFillColor(TEAL)
    c.roundRect(btn_x, btn_y, btn_w, btn_h, 20, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Jost-Bold", 12.5)
    c.drawCentredString(width / 2, btn_y + btn_h / 2 - 4.5, tracked("CONFIRMAR PRESENÇA", " "))
    c.linkURL(rsvp_url, (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h), relative=0, thickness=0)

    # fallback do link em texto simples
    fallback_y = btn_y - 18
    c.setFont("Jost", 8.5)
    c.setFillColor(TEAL_DARK)
    c.drawCentredString(width / 2, fallback_y, "toque no botão acima ou acesse:")
    c.setFont("Jost-Medium", 8.5)
    display_url = rsvp_url.replace("https://", "")
    c.drawCentredString(width / 2, fallback_y - 12, display_url)
    c.linkURL(rsvp_url, (width / 2 - 150, fallback_y - 16, width / 2 + 150, fallback_y + 4), relative=0, thickness=0)

    # rodapé
    c.setFont("Jost-SemiBold", 8)
    c.setFillColor(LAVENDER)
    c.drawCentredString(width / 2, 24, tracked("INSTITUTO HERA", "  "))


def wrap_text(c, text, font_name, font_size, max_width):
    words = text.split(" ")
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if c.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [text]


def generate_pdf(output_path, rsvp_url):
    width, height = A5
    c = canvas.Canvas(output_path, pagesize=A5)
    c.setTitle(f"Convite - {EVENT['title']}")
    c.setAuthor("Instituto Hera")
    draw_invite(c, width, height, rsvp_url)
    c.showPage()
    c.save()


def main():
    global RSVP_BASE_URL
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
    args = parser.parse_args()
    RSVP_BASE_URL = args.base_url

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    register_fonts()

    if args.guests:
        with open(args.guests, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                nome = row["nome"].strip()
                max_convidados = row.get("max_convidados", "").strip() or "1"
                url = build_rsvp_url(nome, max_convidados)
                filename = f"convite-{slugify(nome)}.pdf"
                out_path = os.path.join(OUTPUT_DIR, filename)
                generate_pdf(out_path, url)
                print(f"Gerado: {filename}  ->  {url}")
                count += 1
        print(f"\n{count} convite(s) individuais gerados em {OUTPUT_DIR}/")
    else:
        out_path = os.path.join(OUTPUT_DIR, "convite-instituto-hera.pdf")
        generate_pdf(out_path, build_rsvp_url())
        print(f"Gerado: {out_path}\nLink de RSVP: {build_rsvp_url()}")


if __name__ == "__main__":
    main()
