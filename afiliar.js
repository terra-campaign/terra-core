import {
  auth
} from "./firebase-config.js";


import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


const functions =
  getFunctions(
    auth.app,
    "us-central1"
  );


const getQuickAffiliationContext =
  httpsCallable(
    functions,
    "getQuickAffiliationContext"
  );


const createQuickAffiliation =
  httpsCallable(
    functions,
    "createQuickAffiliation"
  );


const $ =
  id =>
    document.getElementById(
      id
    );


let saving =
  false;


function clean(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}


function resetForm() {

  $("affiliationForm")
    .reset();


  $("whatsappRow")
    .hidden =
    true;


  $("personHasWhatsApp")
    .checked =
    false;


  $("formStatus")
    .textContent =
    "";


  $("successCard")
    .hidden =
    true;


  $("formCard")
    .hidden =
    false;


  $("personName")
    .focus();
}


$("personPhone")
  .addEventListener(
    "input",
    () => {

      const hasPhone =
        $("personPhone")
          .value
          .replace(
            /\D/g,
            ""
          )
          .length >
        0;


      $("whatsappRow")
        .hidden =
        !hasPhone;


      if (!hasPhone) {

        $("personHasWhatsApp")
          .checked =
          false;
      }
    }
  );


$("anotherButton")
  .addEventListener(
    "click",
    resetForm
  );


$("affiliationForm")
  .addEventListener(
    "submit",

    async event => {

      event.preventDefault();


      if (
        saving ||
        !auth.currentUser
      ) {
        return;
      }


      const name =
        clean(
          $("personName")
            .value
        );


      const locality =
        clean(
          $("personLocality")
            .value
        );


      const phone =
        clean(
          $("personPhone")
            .value
        );


      const street =
        clean(
          $("personStreet")
            .value
        );


      const houseNumber =
        clean(
          $("personHouseNumber")
            .value
        );


      const hasWhatsApp =
        phone
          ? $("personHasWhatsApp")
              .checked
          : false;


      if (
        name.length < 2
      ) {

        $("formStatus")
          .textContent =
          "Ingrese el nombre completo.";

        $("personName")
          .focus();

        return;
      }


      if (
        locality.length < 2
      ) {

        $("formStatus")
          .textContent =
          "Ingrese la población.";

        $("personLocality")
          .focus();

        return;
      }


      saving =
        true;


      $("saveButton")
        .disabled =
        true;


      $("saveButton")
        .textContent =
        "Afiliando…";


      $("formStatus")
        .textContent =
        "Guardando afiliación en TERRA…";


      try {

        const {
          data
        } =
          await createQuickAffiliation({

            name,

            locality,

            phone,

            hasWhatsApp,

            street,

            houseNumber
          });


        if (
          data?.success !==
            true ||
          !data?.person?.personId
        ) {

          throw new Error(
            "TERRA no confirmó la afiliación."
          );
        }


        $("formCard")
          .hidden =
          true;


        $("successCard")
          .hidden =
          false;


        $("successText")
          .textContent =
          `${data.person.name} quedó registrado como ${data.membership?.roleLabel || "miembro de la estructura"} bajo la responsabilidad de ${data.membership?.parentUserName || "su responsable territorial"}.`;


      } catch (
        error
      ) {

        console.error(
          "Error al afiliar:",
          error
        );


        $("formStatus")
          .textContent =
          error.message ||
          "No fue posible completar la afiliación.";

      } finally {

        saving =
          false;


        $("saveButton")
          .disabled =
          false;


        $("saveButton")
          .textContent =
          "Afiliar persona";
      }
    }
  );


onAuthStateChanged(
  auth,

  async user => {

    if (!user) {

      window.location.replace(
        "./login.html"
      );

      return;
    }


    try {

      const {
        data
      } =
        await getQuickAffiliationContext();


      if (
        data?.success !==
          true
      ) {

        throw new Error(
          "No fue posible validar la cuenta."
        );
      }


      $("sessionStatus")
        .textContent =
        `Sesión: ${data.caller?.name || "Usuario TERRA"}.`;


      $("contextText")
        .textContent =
        `Desde esta cuenta puedes afiliar directamente a una persona como ${data.targetRoleLabel}. Si debe entrar en otro nivel, envíala con el responsable correspondiente para que la afilie desde su dispositivo.`;


      $("contextCard")
        .hidden =
        false;


      $("formCard")
        .hidden =
        false;


    } catch (
      error
    ) {

      console.error(
        "Acceso de afiliación:",
        error
      );


      $("sessionStatus")
        .textContent =
        error.message ||
        "Esta cuenta no tiene habilitada la afiliación rápida.";


      $("sessionStatus")
        .classList
        .add(
          "error"
        );
    }
  }
);
