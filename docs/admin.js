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

  const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e"]);

  function getInitials(name) {
    const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    const initials = normalized
      .split(/\s+/)
      .filter((word) => word && !CONECTIVOS.has(word.toLowerCase()))
      .map((word) => word[0].toUpperCase())
      .join("");
    return initials || "X";
  }

  function buildRsvpUrl(nome) {
    if (!nome) {
      // Convite genérico: sem nome fixo, o convidado escolhe livremente
      // seu nome e quantas pessoas confirmar (1 a 5) na própria página de RSVP.
      return RSVP_BASE_URL;
    }
    // A quantidade de pessoas também fica livre para o convidado escolher
    // ao confirmar — só o nome vem pré-preenchido.
    const params = new URLSearchParams({ nome });
    return `${RSVP_BASE_URL}?${params.toString()}`;
  }

  function normalizePhone(raw) {
    let digits = raw.replace(/\D/g, "");
    if (digits.length <= 11) {
      digits = "55" + digits;
    }
    return digits;
  }

  function buildWhatsappMessage(nome) {
    const greeting = nome ? `Olá ${nome}! 🌿✨` : "Olá! 🌿✨";
    return [greeting, "", "Preparamos um convite especial para você, confira em anexo 📎"].join(
      "\n"
    );
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

  // No celular, um download de blob nem sempre "salva" o arquivo de
  // verdade (o navegador só abre o PDF numa aba). Por isso preferimos a
  // Web Share API quando disponível: ela abre a folha de compartilhar
  // nativa do aparelho, o arquivo já vai anexado, e a pessoa escolhe o
  // WhatsApp (ou Salvar em Arquivos, etc.) direto por lá.
  async function shareFile(bytes, filename, text) {
    if (!navigator.canShare || !navigator.share) {
      return { supported: false };
    }
    const file = new File([bytes], filename, { type: "application/pdf" });
    if (!navigator.canShare({ files: [file] })) {
      return { supported: false };
    }
    try {
      await navigator.share({ files: [file], text });
      return { supported: true, shared: true };
    } catch (err) {
      if (err.name === "AbortError") {
        return { supported: true, shared: false, cancelled: true };
      }
      return { supported: true, shared: false };
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    statusMsg.textContent = "";
    statusMsg.className = "status-msg";

    const nome = document.getElementById("nome").value.trim();
    const whatsapp = document.getElementById("whatsapp").value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Gerando PDF...";

    try {
      const rsvpUrl = buildRsvpUrl(nome);
      const pdfBytes = await generatePersonalizedPdf(nome, rsvpUrl);
      const filename = nome
        ? `convite-instituto hera-${getInitials(nome)}.pdf`
        : "convite-instituto hera.pdf";
      const text = buildWhatsappMessage(nome);

      const shareResult = await shareFile(pdfBytes, filename, text);

      if (shareResult.shared) {
        statusMsg.textContent =
          "Pronto! Escolha o WhatsApp na tela que abriu — o convite já vai anexado.";
        statusMsg.className = "status-msg success";
      } else if (shareResult.cancelled) {
        statusMsg.textContent = "Compartilhamento cancelado.";
        statusMsg.className = "status-msg";
      } else {
        // Sem suporte a compartilhar arquivo (ex: computador) ou falhou:
        // baixa o PDF e, se houver WhatsApp, já abre a conversa (sem anexo).
        downloadPdf(pdfBytes, filename);

        if (whatsapp) {
          const phone = normalizePhone(whatsapp);
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
      }
    } catch (err) {
      console.error(err);
      statusMsg.textContent = "Algo deu errado ao gerar o convite: " + err.message;
      statusMsg.className = "status-msg error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Gerar e compartilhar convite";
    }
  });
})();
