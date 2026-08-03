(function () {
  const form = document.getElementById("rsvp-form");
  const submitBtn = document.getElementById("submit-btn");
  const errorMsg = document.getElementById("error-msg");
  const formCard = document.getElementById("form-card");
  const confirmCard = document.getElementById("confirm-card");
  const confirmName = document.getElementById("confirm-name");
  const confirmCount = document.getElementById("confirm-count");
  const calendarLink = document.getElementById("calendar-link");
  const nomeInput = document.getElementById("nome");
  const convidadosSelect = document.getElementById("convidados");

  // Convites personalizados podem trazer ?nome=...&max=... na URL para
  // pré-preencher o nome do convidado e limitar quantos acompanhantes
  // aquele convite específico permite.
  (function applyPersonalizedLink() {
    const params = new URLSearchParams(window.location.search);
    const nome = params.get("nome");
    const max = parseInt(params.get("max"), 10);

    if (nome) {
      nomeInput.value = nome;
    }

    if (Number.isInteger(max) && max >= 1 && max <= 20) {
      convidadosSelect.innerHTML = "";
      for (let i = 1; i <= max; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = i === 1 ? "1 pessoa" : `${i} pessoas`;
        convidadosSelect.appendChild(opt);
      }
    }
  })();

  const EVENT = {
    title: "Inauguração do Instituto Hera",
    location: "Rua Quirino do Amaral Campos, 144 - sala 705, Cambuí",
    start: "20260912T090000",
    end: "20260912T120000",
  };

  function buildIcsDataUri() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `SUMMARY:${EVENT.title}`,
      `LOCATION:${EVENT.location}`,
      `DTSTART:${EVENT.start}`,
      `DTEND:${EVENT.end}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }

  function isEndpointConfigured() {
    return (
      typeof GAS_ENDPOINT === "string" &&
      GAS_ENDPOINT.startsWith("http") &&
      !GAS_ENDPOINT.includes("COLE_AQUI")
    );
  }

  async function sendRsvp(nome, convidados) {
    if (!isEndpointConfigured()) {
      console.warn(
        "GAS_ENDPOINT não configurado em config.js — a confirmação não foi salva na planilha."
      );
      return;
    }
    await fetch(GAS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        nome,
        convidados,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMsg.textContent = "";

    const nome = document.getElementById("nome").value.trim();
    const convidados = document.getElementById("convidados").value;

    if (!nome) {
      errorMsg.textContent = "Por favor, digite seu nome.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    try {
      await sendRsvp(nome, convidados);
    } catch (err) {
      console.error("Falha ao enviar RSVP:", err);
    }

    confirmName.textContent = nome;
    confirmCount.textContent =
      convidados === "1" ? "1 pessoa confirmada" : `${convidados} pessoas confirmadas`;
    calendarLink.href = buildIcsDataUri();
    calendarLink.setAttribute("download", "inauguracao-instituto-hera.ics");

    formCard.classList.add("hidden");
    confirmCard.classList.remove("hidden");
  });
})();
