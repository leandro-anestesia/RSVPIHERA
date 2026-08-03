(function () {
  const { PDFDocument, PDFName, PDFArray, PDFString } = PDFLib;

  const form = document.getElementById("admin-form");
  const submitBtn = document.getElementById("submit-btn");
  const statusMsg = document.getElementById("status-msg");

  const CONVITE_BASE_PDF_URL = "assets/convite_base.pdf";

  // Coordenadas do botão "CONFIRMAR PRESENÇA (RSVP)" e da legenda abaixo
  // dele, detectadas no PDF original. Sistema "topo-para-baixo" (y cresce
  // para baixo a partir do topo da página) — mesmas coordenadas usadas em
  // scripts/add_rsvp_link.py. Se o design do convite mudar, atualize os
  // dois lugares.
  const BUTTON_TOP_DOWN = { x0: 155, y0: 663, x1: 440, y1: 707 };
  const CAPTION_TOP_DOWN = { x0: 140, y0: 710, x1: 455, y1: 730 };

  function toBottomUpRect(topDown, pageHeight) {
    return {
      x: topDown.x0,
      y: pageHeight - topDown.y1,
      width: topDown.x1 - topDown.x0,
      height: topDown.y1 - topDown.y0,
    };
  }

  function addLinkAnnotation(pdfDoc, page, uri, rect) {
    const linkAnnotation = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(uri),
      },
    });
    const linkRef = pdfDoc.context.register(linkAnnotation);

    const existingAnnots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (existingAnnots) {
      existingAnnots.push(linkRef);
    } else {
      page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([linkRef]));
    }
  }

  function slugify(name) {
    const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    const slug = normalized
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return slug || "convidado";
  }

  function buildRsvpUrl(nome, max) {
    if (!nome) {
      // Convite genérico: sem nome fixo, o convidado escolhe livremente
      // quantas pessoas confirmar (1 a 4) na própria página de RSVP.
      return RSVP_BASE_URL;
    }
    const params = new URLSearchParams({ nome, max: String(max) });
    return `${RSVP_BASE_URL}?${params.toString()}`;
  }

  function normalizePhone(raw) {
    let digits = raw.replace(/\D/g, "");
    if (digits.length <= 11) {
      digits = "55" + digits;
    }
    return digits;
  }

  function buildWhatsappMessage(nome, rsvpUrl) {
    const greeting = nome ? `Olá ${nome}! 🌿✨` : "Olá! 🌿✨";
    return [
      greeting,
      "",
      "Você está convidado(a) para a inauguração do *Instituto Hera*!",
      "",
      "📅 Sábado, 12 de setembro de 2026",
      "🕘 09h às 12h",
      "📍 Rua Quirino do Amaral Campos, 144 — sala 705, Cambuí",
      "",
      "Seu convite em PDF está anexado a esta conversa 📎",
      `Confirme sua presença por aqui: ${rsvpUrl}`,
      "",
      "Será um prazer ter você conosco! 💛",
    ].join("\n");
  }

  async function generatePersonalizedPdf(nome, rsvpUrl) {
    const response = await fetch(CONVITE_BASE_PDF_URL);
    if (!response.ok) {
      throw new Error("Não foi possível carregar o PDF base do convite.");
    }
    const baseBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(baseBytes);
    const page = pdfDoc.getPages()[0];
    const pageHeight = page.getHeight();

    addLinkAnnotation(pdfDoc, page, rsvpUrl, toBottomUpRect(BUTTON_TOP_DOWN, pageHeight));
    addLinkAnnotation(pdfDoc, page, rsvpUrl, toBottomUpRect(CAPTION_TOP_DOWN, pageHeight));

    return pdfDoc.save();
  }

  function downloadPdf(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    statusMsg.textContent = "";
    statusMsg.className = "status-msg";

    const nome = document.getElementById("nome").value.trim();
    const whatsapp = document.getElementById("whatsapp").value.trim();
    const max = document.getElementById("max").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Gerando PDF...";

    try {
      const rsvpUrl = buildRsvpUrl(nome, max);
      const pdfBytes = await generatePersonalizedPdf(nome, rsvpUrl);
      const filename = nome ? `convite-${slugify(nome)}.pdf` : "convite-generico.pdf";
      downloadPdf(pdfBytes, filename);

      if (whatsapp) {
        const phone = normalizePhone(whatsapp);
        const text = buildWhatsappMessage(nome, rsvpUrl);
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

        statusMsg.textContent =
          "PDF baixado! Abrindo o WhatsApp — anexe o arquivo baixado antes de enviar.";
        statusMsg.className = "status-msg success";

        window.open(waUrl, "_blank");
      } else {
        statusMsg.textContent =
          "PDF baixado! Nenhum WhatsApp informado, envie manualmente pelo canal que preferir.";
        statusMsg.className = "status-msg success";
      }
    } catch (err) {
      console.error(err);
      statusMsg.textContent = "Algo deu errado ao gerar o convite: " + err.message;
      statusMsg.className = "status-msg error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Gerar PDF e abrir WhatsApp";
    }
  });
})();
