/**
 * Recebe as confirmações de presença enviadas pela página de RSVP
 * (docs/index.html) e grava uma linha na planilha ativa.
 *
 * Como publicar:
 * 1. Crie uma Planilha Google nova (ou use uma existente).
 * 2. Menu Extensões > Apps Script.
 * 3. Apague o conteúdo padrão e cole todo este arquivo.
 * 4. Clique em Implantar > Nova implantação.
 * 5. Tipo: "App da Web". Executar como: "Eu". Quem pode acessar: "Qualquer pessoa".
 * 6. Implante e copie a URL gerada (termina em /exec).
 * 7. Cole essa URL em docs/config.js na constante GAS_ENDPOINT.
 */

const SHEET_NAME = "RSVPs";

function doPost(e) {
  const sheet = getOrCreateSheet_();
  const data = JSON.parse(e.postData.contents);

  const nome = (data.nome || "").toString().trim();
  const convidados = Number(data.convidados) || 1;
  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

  sheet.appendRow([timestamp, nome, convidados]);

  return ContentService.createTextOutput(
    JSON.stringify({ ok: true })
  ).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Data/Hora", "Nome", "N° de convidados"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
