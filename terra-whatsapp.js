import {
  whatsappPhone
} from "./whatsapp-phone.js?v=terra-whatsapp-001";


function element(
  tag,
  text = ""
) {

  const node =
    document.createElement(tag);

  node.textContent =
    text;

  return node;
}


function openWhatsApp(
  url,
  status,
  statusText
) {

  status.textContent =
    statusText;


  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );
}


export function createTerraWhatsAppCommunication({
  recipientName = "destinatario",
  phone = "",
  hasWhatsApp = false,
  message = "",
  buttonLabel = "Comunicar por WhatsApp",
  panelTitle = "Comunicar por WhatsApp",
  directButtonLabel = "",
  manualButtonLabel = "Elegir otro contacto en WhatsApp"
} = {}) {

  const wrapper =
    element("div");


  wrapper.className =
    "terra-whatsapp";


  const trigger =
    element(
      "button",
      buttonLabel
    );


  trigger.type =
    "button";


  trigger.className =
    "button button-whatsapp terra-whatsapp__trigger";


  const panel =
    element("section");


  panel.className =
    "terra-whatsapp__panel";


  panel.hidden =
    true;


  const title =
    element(
      "h4",
      panelTitle
    );


  const recipient =
    element(
      "p",
      `Destinatario: ${
        recipientName ||
        "Sin nombre"
      }`
    );


  recipient.className =
    "terra-whatsapp__recipient";


  const messageLabel =
    element(
      "label",
      "Mensaje preparado"
    );


  const textarea =
    document.createElement(
      "textarea"
    );


  textarea.rows =
    12;


  textarea.value =
    String(
      message ||
      ""
    );


  textarea.className =
    "terra-whatsapp__message";


  const status =
    element(
      "p",
      ""
    );


  status.className =
    "terra-whatsapp__status";


  const actions =
    element("div");


  actions.className =
    "terra-whatsapp__actions";


  const manual =
    element(
      "button",
      manualButtonLabel
    );


  manual.type =
    "button";


  manual.className =
    "button button-whatsapp";


  manual.addEventListener(
    "click",
    () => {

      openWhatsApp(
        "https://wa.me/?text=" +
          encodeURIComponent(
            textarea.value
          ),
        status,
        "Abriendo WhatsApp para elegir el contacto. Revisa el mensaje y confirma el envío en WhatsApp."
      );
    }
  );


  const savedPhone =
    String(
      phone ||
      ""
    ).trim();


  if (
    hasWhatsApp === true &&
    savedPhone
  ) {

    const countryLabel =
      element(
        "label",
        "País del teléfono"
      );


    const country =
      document.createElement(
        "select"
      );


    country.className =
      "terra-whatsapp__country";


    country.innerHTML =
      '<option value="mx">México (+52)</option>' +
      '<option value="intl">Otro país · número completo</option>';


    const phoneLabel =
      element(
        "label",
        "Teléfono"
      );


    const phoneInput =
      document.createElement(
        "input"
      );


    phoneInput.type =
      "tel";


    phoneInput.value =
      savedPhone;


    phoneInput.autocomplete =
      "tel";


    phoneInput.className =
      "terra-whatsapp__phone";


    const help =
      element(
        "p",
        "México: escribe 10 dígitos. Si ya incluye +52, no se duplicará."
      );


    help.className =
      "terra-whatsapp__help";


    const preview =
      element(
        "p",
        ""
      );


    preview.className =
      "terra-whatsapp__preview";


    const updatePreview =
      () => {

        try {

          const number =
            whatsappPhone(
              phoneInput.value,
              country.value
            );


          preview.textContent =
            `Se abrirá WhatsApp para: +${number}`;

        } catch (error) {

          preview.textContent =
            error.message;
        }
      };


    phoneInput.addEventListener(
      "input",
      updatePreview
    );


    country.addEventListener(
      "change",
      updatePreview
    );


    updatePreview();


    const direct =
      element(
        "button",
        directButtonLabel ||
          `Abrir WhatsApp con ${
            recipientName ||
            "destinatario"
          }`
      );


    direct.type =
      "button";


    direct.className =
      "button button-whatsapp";


    direct.addEventListener(
      "click",
      () => {

        try {

          const number =
            whatsappPhone(
              phoneInput.value,
              country.value
            );


          openWhatsApp(
            "https://wa.me/" +
              number +
              "?text=" +
              encodeURIComponent(
                textarea.value
              ),
            status,
            `Abriendo WhatsApp para +${number}. Revisa el mensaje y confirma el envío en WhatsApp.`
          );

        } catch (error) {

          status.textContent =
            error.message;
        }
      }
    );


    panel.append(
      title,
      recipient,
      countryLabel,
      country,
      phoneLabel,
      phoneInput,
      help,
      preview,
      messageLabel,
      textarea
    );


    actions.append(
      direct,
      manual
    );

  } else {

    const unavailable =
      element(
        "p",
        "Este perfil no tiene un número de WhatsApp confirmado para apertura directa. Puedes elegir el contacto manualmente."
      );


    unavailable.className =
      "terra-whatsapp__help";


    panel.append(
      title,
      recipient,
      unavailable,
      messageLabel,
      textarea
    );


    actions.append(
      manual
    );
  }


  panel.append(
    actions,
    status
  );


  trigger.addEventListener(
    "click",
    () => {

      panel.hidden =
        !panel.hidden;


      trigger.textContent =
        panel.hidden
          ? buttonLabel
          : "Cerrar comunicación";
    }
  );


  wrapper.append(
    trigger,
    panel
  );


  return wrapper;
}
