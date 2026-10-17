import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";


const functions =
  getFunctions(
    auth.app,
    "us-central1"
  );

const getMyOnboardingStatus =
  httpsCallable(
    functions,
    "getMyOnboardingStatus"
  );

const completeOnboarding =
  httpsCallable(
    functions,
    "completeOnboarding"
  );

const updateMyActivityPreferences =
  httpsCallable(
    functions,
    "updateMyActivityPreferences"
  );


const getMyActivityPreferences =
  httpsCallable(
    functions,
    "getMyActivityPreferences"
  );

const stepLabel =
  document.getElementById("onboardingStep");

const title =
  document.getElementById("onboardingTitle");

const description =
  document.getElementById("onboardingDescription");

const content =
  document.getElementById("onboardingContent");

const message =
  document.getElementById("onboardingMessage");

const previousButton =
  document.getElementById("previousButton");

const nextButton =
  document.getElementById("nextButton");

const logoutButton =
  document.getElementById("logoutButton");


let currentStep = 0;
let profile = null;
let responsibleName = "";
let onboardingStatus = null;
let finishing = false;
let initialized = false;
let savingActivityPreferences = false;
let reviewMode = false;

const activityPreferences = {
  territorial_brigade: false,
  material_distribution: false,
  structure_growth: false,
  event_logistics: false,
  digital_activity: false,
  wall_painting: false,
  operational_accompaniment: false,
  other_configurable: false
};

const acknowledgedCriteria =
  new Set();


const params =
  new URLSearchParams(
    window.location.search
  );

const missionId =
  params.get("mission");

const eventInvitationId =
  params.get("eventInvitation");


const validInternalId =
  value =>
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value);


const destination =
  validInternalId(missionId)
    ? `./mision.html?id=${encodeURIComponent(missionId)}`
    : validInternalId(eventInvitationId)
      ? `./eventos.html?invitation=${encodeURIComponent(eventInvitationId)}`
      : "./admin.html";


function reviewHomeDestination() {
  return profile?.role === "lider_principal"
    ? "./direccion.html"
    : "./admin.html";
}

function cleanText(value) {

  return typeof value === "string"
    ? value.trim()
    : "";
}


function displayValue(...values) {

  for (const value of values) {

    const cleaned =
      cleanText(value);

    if (cleaned) {
      return cleaned;
    }
  }

  return "No especificado";
}


function roleLabel(role) {

  const labels = {
    lider_principal:
      "Líder principal",

    coordinador_municipal:
      "Coordinador municipal",

    jefe_estructura:
      "Responsable de estructura",

    integrante:
      "Integrante",

    participante:
      "Participante",

    colaborador_base:
      "Colaborador de base",

    apoyo_territorial:
      "Apoyo territorial"
  };

  return labels[role] ||
    displayValue(role);
}


async function resolveResponsibleName(person) {
  if (person?.role === "lider_principal") {
    return "No aplica";
  }

  return displayValue(
    person?.parentUserName,
    person?.parentName,
    person?.structureChiefName,
    person?.chiefName
  );
}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function infoList(items) {

  return `
    <div class="grid">
      ${items.map(item => `
        <article class="card">
          <p class="eyebrow">
            ${escapeHtml(item.label)}
          </p>
          <strong>
            ${escapeHtml(item.value)}
          </strong>
        </article>
      `).join("")}
    </div>
  `;
}


const steps = [

  {
    key:
      "welcome",

    label:
      "PASO 1 DE 9",

    title:
      "Bienvenido a TERRA Campaign",

    description:
      "Tu participación puede dejar huella.",

    render:
      () => `
        <h3>¡BIENVENIDO A TERRA CAMPAIGN!</h3>

        <p>
          Hoy comienzas una nueva etapa de participación
          y organización.
        </p>

        <p>
          Formas parte de un equipo en el que tus ideas,
          capacidades y contribuciones son importantes.
        </p>

        <p>
          <strong>¡TU TRABAJO CUENTA!</strong>
        </p>

        <p>
          TERRA permite registrar actividades y reconocer
          contribuciones operativas verificadas.
        </p>

        <p>
          Podrás consultar tus resultados en
          <strong>Mi desempeño</strong>, conforme a
          las reglas de puntuación vigentes.
        </p>

        <p>
          No necesitas cambiar de función organizacional
          para destacar por tus resultados.
        </p>

        <p>
          Tu participación es voluntaria y tus decisiones
          personales deben ser respetadas.
        </p>

        <p>
          A continuación conocerás tu organización,
          tu responsable, tus actividades y cómo comenzar.
        </p>

        <p>
          <strong>¡ESTO ES SOLO EL PRINCIPIO!</strong>
        </p>
      `
  },


  {
    key:
      "identity",

    criterion:
      "localityKnown",

    label:
      "PASO 2 DE 9",

    title:
      "Tu lugar en nuestra organización",

    description:
      "Conoce tu identidad, tu función y la campaña a la que perteneces.",

    render:
      () =>
        infoList([
          {
            label:
              "MI NOMBRE",
            value:
              displayValue(profile?.name)
          },
          {
            label:
              "MI FUNCIÓN",
            value:
              roleLabel(profile?.role)
          },
          {
            label:
              "MI CAMPAÑA",
            value:
              displayValue(
                profile?.campaignName,
                profile?.campaignId
              )
          },
          {
            label:
              "IDENTIFICADOR DE CAMPAÑA",
            value:
              displayValue(profile?.campaignId)
          },
          {
            label:
              "MI MUNICIPIO",
            value:
              displayValue(
                profile?.municipalityName,
                profile?.municipalityId
              )
          },
          {
            label:
              "MI LOCALIDAD",
            value:
              displayValue(profile?.locality)
          }
        ]) +
        `
          <h3>¡AQUÍ TODOS TENEMOS UN LUGAR!</h3>

          <p>
            Ya formas parte de una organización en la que
            cada persona tiene una función importante.
          </p>

          <p>
            Queremos que conozcas tu equipo, participes
            de acuerdo con tus capacidades y tengas
            oportunidad de desarrollar tus habilidades.
          </p>

          <p>
            <strong>
              Tu esfuerzo y tus contribuciones
              verificadas pueden dejar huella.
            </strong>
          </p>

          <p>
            Si alguno de tus datos no corresponde
            a tu registro, solicita su revisión
            con tu responsable.
          </p>
        `
  },


  {
    key:
      "structure",

    criterion:
      "structureKnown",

    label:
      "PASO 3 DE 9",

    title:
      "Mi estructura: aquí todos somos importantes",

    description:
      "Conoce tu lugar en el equipo y cómo se reconoce tu desempeño.",

    render:
      () =>
        infoList([
          {
            label:
              "MI ESTRUCTURA",
            value:
              displayValue(
                profile?.structureName,
                profile?.structureId,
                profile?.role === "lider_principal" ||
                profile?.role === "coordinador_municipal"
                  ? "No aplica"
                  : ""
              )
          },
          {
            label:
              "MI CAMPAÑA",
            value:
              displayValue(
                profile?.campaignName,
                profile?.campaignId
              )
          },
          {
            label:
              "MI FUNCIÓN",
            value:
              roleLabel(profile?.role)
          }
        ]) +
        `
          <h3>¡AQUÍ TODOS TENEMOS UN LUGAR!</h3>

          <p>
            Nuestra organización utiliza diferentes
            funciones para coordinar actividades
            y facilitar el trabajo en equipo.
          </p>

          <p>
            <strong>
              Los niveles organizacionales no representan
              superioridad personal ni mayor mérito.
            </strong>
          </p>

          <p>
            Cada función tiene responsabilidades y permisos,
            pero todas las personas pueden contribuir.
          </p>

          <h3>¡TU TRABAJO ES LO QUE CUENTA!</h3>

          <p>
            No necesitas cambiar de nivel organizacional
            para destacar por tus resultados.
          </p>

          <p>
            Las contribuciones operativas verificadas
            pueden generar puntos conforme a las
            reglas vigentes de TERRA.
          </p>

          <p>
            Tu Responsable de Estructura puede consultar
            el Índice de Puntuaciones de su equipo
            dentro de su alcance autorizado.
          </p>

          <p>
            <strong>
              Tu posición en ese índice depende de
              tus puntos acreditados, no del nombre
              de tu función.
            </strong>
          </p>

          <p>
            Obtener más puntos no cambia automáticamente
            tu función ni tus permisos.
          </p>

          <p>
            <strong>
              ¡QUE TU TRABAJO DEJE HUELLA!
            </strong>
          </p>
        `
  },


  {
    key:
      "responsible",

    criterion:
      "responsibleKnown",

    label:
      "PASO 4 DE 9",

    title:
      "Conoce a tu responsable",

    description:
      "La organización cuenta con personas encargadas de orientar y coordinar las actividades.",

    render:
      () =>
        infoList([
          {
            label:
              "MI REFERENCIA ORGANIZACIONAL",
            value:
              displayValue(responsibleName)
          }
        ]) +
        `
          <h3>¡EN TERRA TRABAJAMOS EN EQUIPO!</h3>

          <p>
            Formas parte de una organización donde
            la comunicación, la colaboración y
            el respeto son fundamentales.
          </p>

          <p>
            Tu responsable organizacional es una
            referencia para recibir orientación
            y dar seguimiento a tus actividades.
          </p>

          <h3>¡PREGUNTA, PROPÓN Y PARTICIPA!</h3>

          <p>
            Cuando tengas dudas sobre una misión,
            evento o actividad, solicita orientación
            a la persona responsable de tu seguimiento.
          </p>

          <p>
            Puedes compartir propuestas, comunicar
            dificultades y solicitar aclaraciones
            sobre las actividades de tu equipo.
          </p>

          <p>
            <strong>
              Ser responsable de un equipo implica
              coordinar y acompañar, no tener
              mayor valor personal que los demás.
            </strong>
          </p>

          <p>
            Las actividades verificadas pertenecen
            a quienes realmente las realizan.
          </p>

          <p>
            Las validaciones y decisiones operativas
            corresponden a las personas que cuentan
            con los permisos necesarios.
          </p>

          <p>
            <strong>
              ¡UN BUEN EQUIPO SE FORTALECE
              CUANDO TODOS COLABORAN!
            </strong>
          </p>
        `
  },


  {
    key:
      "responsibilities",

    criterion:
      "responsibilitiesUnderstood",

    label:
      "PASO 5 DE 9",

    title:
      "Mis responsabilidades: comienza con tu equipo",

    description:
      "Conoce cómo puedes colaborar, fortalecer tu organización y obtener reconocimiento por tus contribuciones verificadas.",

    render:
      () => `
        <h3>¡TU PARTICIPACIÓN COMIENZA AQUÍ!</h3>

        <p>
          Una organización se fortalece con las
          personas que deciden participar.
        </p>

        <p>
          Puedes comenzar invitando a familiares,
          amistades, vecinos y conocidos que
          voluntariamente deseen integrarse.
        </p>

        <p>
          <strong>¡CADA PERSONA ES IMPORTANTE!</strong>
        </p>

        <p>
          Cuando tu función lo autorice, podrás
          incorporar personas utilizando las
          herramientas de Mi organización.
        </p>

        <p>
          TERRA establece reglas para cada nivel.
          Registrar una persona no significa
          que automáticamente quede validada
          su incorporación.
        </p>

        <h3>¡TU TRABAJO PUEDE GENERAR PUNTOS!</h3>

        <p>
          El crecimiento organizacional validado
          contempla reconocimiento por etapas,
          conforme a las reglas vigentes.
        </p>

        <p>
          Para completar una incorporación validada
          se consideran la identidad de la persona,
          su membresía correcta, su orientación
          y una primera actividad verificable.
        </p>

        <p>
          <strong>
            Registrar solamente un nombre no
            acredita automáticamente los puntos
            completos de crecimiento.
          </strong>
        </p>

        <p>
          También podrás participar en misiones,
          reuniones, eventos y otras actividades
          que correspondan a tu función.
        </p>

        <p>
          Las contribuciones operativas verificadas
          podrán sumar puntos cuando cumplan los
          requisitos aplicables.
        </p>

        <h3>CONOCE EL CATÁLOGO DE PUNTOS</h3>

        <p>
          Consulta el Catálogo de Puntos cuando
          esté disponible en tu plataforma para
          conocer actividades, valores y requisitos.
        </p>

        <p>
          En Mi desempeño podrás consultar los
          puntos que hayan sido efectivamente
          acreditados a tu perfil.
        </p>

        <p>
          <strong>
            ¡NO NECESITAS CAMBIAR DE NIVEL
            PARA DESTACAR!
          </strong>
        </p>

        <p>
          Tu esfuerzo, tu constancia y tus
          contribuciones verificadas son lo
          que cuenta en TERRA Campaign.
        </p>
      `
  },


  {
    key:
      "activities",

    criterion:
      "optionalActivitiesExplained",

    label:
      "PASO 6 DE 9",

    title:
      "Actividades en las que puedo apoyar",

    description:
      "Selecciona las actividades que te interesan. Puedes elegir una, varias o ninguna. Tus preferencias no representan compromisos aceptados.",

    render:
      () => `
        <h3>¡TUS CAPACIDADES SON IMPORTANTES!</h3>

        <p>
          Cada persona tiene habilidades, experiencias
          e intereses diferentes.
        </p>

        <p>
          Queremos conocer en qué actividades
          te gustaría colaborar.
        </p>

        <p>
          <strong>
            Selecciona las opciones que realmente
            sean de tu interés.
          </strong>
        </p>

        <p>
          Esta selección representa tus preferencias.
          No certifica aptitudes, no establece horarios
          de disponibilidad y no significa que hayas
          aceptado automáticamente una misión.
        </p>

        <p>
          Puedes actualizar tus preferencias
          posteriormente cuando lo necesites.
        </p>

        <div class="grid">
          <article class="card"><label><input type="checkbox" data-activity-preference="territorial_brigade"> <strong>Brigadeo y actividad territorial</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="material_distribution"> <strong>Volanteo y distribución de materiales</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="structure_growth"> <strong>Organización y crecimiento de estructura</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="event_logistics"> <strong>Logística de apoyo en eventos</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="digital_activity"> <strong>Actividad digital y redes sociales</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="wall_painting"> <strong>Pinta de bardas</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="operational_accompaniment"> <strong>Acompañamiento operativo en misiones</strong></label></article>
          <article class="card"><label><input type="checkbox" data-activity-preference="other_configurable"> <strong>Otras actividades configurables</strong></label></article>
        </div>

        <p>
          Seleccionar una actividad no significa que ya estás aceptando una tarea.
          Cuando exista una actividad concreta, podrás conocerla y asumir el
          compromiso correspondiente.
        </p>

        <p>
          <strong>Marcar más opciones no aumenta tu calificación.</strong>
          Tu desempeño se construye con tu participación real: las actividades
          que realices y sean validadas podrán contribuir a tu historial,
          reconocimiento y puntuación dentro de TERRA.
        </p>
      `
  },


  {
    key:
      "availability",

    criterion:
      "preferenceCommitmentDistinctionUnderstood",

    label:
      "PASO 7 DE 9",

    title:
      "Tu tiempo y tus compromisos",

    description:
      "Conoce la diferencia entre recibir una invitación, aceptar una actividad y cumplirla.",

    render:
      () => `
        <h3>¡TU TIEMPO ES IMPORTANTE!</h3>

        <p>
          Sabemos que cada persona tiene
          responsabilidades personales,
          familiares y laborales.
        </p>

        <p>
          En TERRA Campaign valoramos tu
          participación y respetamos tu tiempo.
        </p>

        <p>
          <strong>
            Participar es una decisión voluntaria.
          </strong>
        </p>

        <h3>RECIBIR UNA INVITACIÓN</h3>

        <p>
          Tu equipo puede comunicarte una misión,
          evento o actividad en la que podrías
          colaborar.
        </p>

        <p>
          Recibir esa información no significa
          que hayas aceptado un compromiso.
        </p>

        <h3>ACEPTAR UN COMPROMISO</h3>

        <p>
          Cuando decidas participar en una
          actividad concreta, podrás conocer
          sus indicaciones y responsabilidades.
        </p>

        <p>
          La aceptación de una actividad
          y su cumplimiento son etapas distintas.
        </p>

        <h3>CUMPLIR Y ACREDITAR</h3>

        <p>
          Para reconocer una contribución
          operativa, TERRA considera las
          evidencias y validaciones exigidas
          por las reglas aplicables.
        </p>

        <p>
          <strong>
            Aceptar una invitación no genera
            automáticamente puntos por cumplimiento.
          </strong>
        </p>

        <h3>¿Y MIS PREFERENCIAS?</h3>

        <p>
          Las actividades que seleccionaste
          anteriormente representan tus intereses.
        </p>

        <p>
          No equivalen a horarios disponibles
          ni a compromisos ya aceptados.
        </p>

        <p>
          Esta orientación no solicita
          horarios de disponibilidad.
        </p>

        <p>
          <strong>
            ¡LO IMPORTANTE ES QUE CADA
            CONTRIBUCIÓN SEA REAL Y VERIFICABLE!
          </strong>
        </p>
      `
  },


  {
    key:
      "performance",

    criterion:
      "performanceEvaluationExplained",

    label:
      "PASO 8 DE 9",

    title:
      "Mi desempeño y mis puntos",

    description:
      "Conoce cómo se reconocen tus contribuciones y cómo puedes consultar tus resultados.",

    render:
      () => `
        <h3>¡TU TRABAJO CUENTA!</h3>

        <p>
          En TERRA Campaign cada persona
          puede construir un historial
          de participación y contribuciones.
        </p>

        <p>
          Lo importante no es solamente
          aceptar actividades, sino
          realizar aportaciones reales
          que puedan verificarse.
        </p>

        <h3>¿CÓMO SE ACREDITA MI TRABAJO?</h3>

        <p>
          <strong>1. ACTIVIDAD</strong>
        </p>

        <p>
          Participas en una misión,
          evento u otra actividad
          autorizada.
        </p>

        <p>
          <strong>2. EVIDENCIA</strong>
        </p>

        <p>
          Cuando corresponde, se registra
          la información necesaria para
          comprobar tu participación.
        </p>

        <p>
          <strong>3. VALIDACIÓN</strong>
        </p>

        <p>
          La evidencia se revisa de
          acuerdo con las reglas y
          autorizaciones aplicables.
        </p>

        <p>
          <strong>4. PUNTUACIÓN</strong>
        </p>

        <p>
          Si la contribución cumple
          los requisitos de una regla
          de puntuación vigente, podrán
          acreditarse los puntos
          correspondientes.
        </p>

        <p>
          <strong>
            Recibir una invitación
            o aceptar una actividad
            no acredita automáticamente
            puntos por cumplimiento.
          </strong>
        </p>

        <h3>MI DESEMPEÑO</h3>

        <p>
          Tus puntos acreditados
          corresponden a tu perfil
          operativo y a las contribuciones
          verificadas que los originaron.
        </p>

        <p>
          Puedes consultar la información
          de desempeño disponible para
          tu perfil y función autorizada.
        </p>

        <h3>ÍNDICE DE PUNTUACIONES</h3>

        <p>
          El Índice de Puntuaciones
          permite comparar resultados
          operativos utilizando puntos
          efectivamente acreditados,
          dentro del alcance autorizado.
        </p>

        <p>
          Los responsables que cuenten
          con permisos de consulta
          pueden dar seguimiento
          al desempeño de su equipo.
        </p>

        <p>
          <strong>
            Tu función organizacional
            no determina automáticamente
            tu posición por puntos.
          </strong>
        </p>

        <p>
          Una persona de un nivel
          organizacional distinto
          puede acumular más puntos
          gracias a sus contribuciones.
        </p>

        <p>
          Sin embargo, obtener más
          puntos no modifica por sí solo
          tu función ni tus permisos.
        </p>

        <h3>¡CONSTRUYE TU PROPIA TRAYECTORIA!</h3>

        <p>
          Cada contribución verificada
          puede formar parte de tu
          historial operativo.
        </p>

        <p>
          <strong>
            ¡QUE TUS RESULTADOS
            HABLEN DE TU TRABAJO!
          </strong>
        </p>
      `
  },


  {
    key:
      "communication",

    criterion:
      "helpAvailable",

    label:
      "PASO 9 DE 9",

    title:
      "¡Bienvenido! Tu participación comienza ahora",

    description:
      "Ya conoces tu organización, tus responsabilidades y cómo se reconocen tus contribuciones.",

    render:
      () => {

        const firstActions = {
          lider_principal:
            "Revisa las herramientas de dirección y coordinación de tu campaña que estén autorizadas para tu cuenta.",

          coordinador_municipal:
            "Conoce las estructuras y actividades de tu municipio desde las herramientas habilitadas para tu función.",

          jefe_estructura:
            "Revisa tu organización, orienta a los integrantes bajo tu responsabilidad y consulta las herramientas de seguimiento autorizadas.",

          integrante:
            "Conoce tu equipo y revisa las opciones habilitadas para incorporar participantes que voluntariamente deseen integrarse.",

          participante:
            "Conoce a tu responsable y revisa las herramientas autorizadas para colaborar y organizar a tus integrantes directos.",

          colaborador_base:
            "Conoce las actividades que correspondan a tu función y las opciones autorizadas de coordinación con apoyos territoriales.",

          apoyo_territorial:
            "Consulta las actividades asignadas a tu función y solicita orientación a tu responsable. Tu nivel no incorpora subordinados de otro nivel."
        };

        const firstAction =
          firstActions[profile?.role] ||
          "Consulta las herramientas disponibles para tu perfil y solicita orientación a tu responsable.";

        return `
          <h3>¡ESTO ES SOLO EL PRINCIPIO!</h3>

          <p>
            Hoy conociste tu lugar dentro de
            TERRA Campaign, tus responsabilidades
            y las herramientas de participación.
          </p>

          <p>
            <strong>¡QUEREMOS CONTAR CONTIGO!</strong>
          </p>

          <p>
            Tus ideas, tu experiencia y tu trabajo
            pueden contribuir al fortalecimiento
            de tu equipo y de tu comunidad.
          </p>

          <h3>¡TU TRABAJO ES LO QUE CUENTA!</h3>

          <p>
            No importa el nombre de tu nivel
            organizacional: tus contribuciones
            operativas verificadas permiten
            construir una trayectoria propia.
          </p>

          <p>
            Podrás consultar tus puntos
            efectivamente acreditados
            mediante las herramientas de
            desempeño habilitadas.
          </p>

          <p>
            <strong>
              Tu historial puede mostrar
              lo que has hecho, cuándo
              participaste y cuáles de tus
              contribuciones fueron verificadas.
            </strong>
          </p>

          <h3>¿CÓMO COMIENZO?</h3>

          <p>
            Tu función registrada es:
            <strong>${escapeHtml(roleLabel(profile?.role))}</strong>
          </p>

          <p>
            ${escapeHtml(firstAction)}
          </p>

          <h3>¡NO ESTÁS SOLO EN ESTE RECORRIDO!</h3>

          <p>
            Si necesitas orientación,
            consulta a tu referencia
            organizacional o los medios
            de ayuda habilitados.
          </p>

          <p>
            Las novedades relacionadas
            con misiones, eventos y otras
            actividades podrán comunicarse
            mediante los canales autorizados.
          </p>

          <p>
            ${reviewMode ? "Esta consulta no modifica tus preferencias ni vuelve a registrar tu capacitación." : "Al seleccionar Finalizar, TERRA solicitará al servidor la confirmación de esta orientación inicial."}
          </p>

          <p>
            <strong>¡QUE TU TRABAJO DEJE HUELLA!</strong>
          </p>

          <h3>¡BIENVENIDO A TERRA CAMPAIGN!</h3>
        `;
      }
  }

];


function bindActivityPreferenceControls() {

  const controls =
    content.querySelectorAll(
      "[data-activity-preference]"
    );

  for (const control of controls) {

    const key =
      control.dataset.activityPreference;

    if (
      !Object.prototype.hasOwnProperty.call(
        activityPreferences,
        key
      )
    ) {
      continue;
    }

    control.checked =
      activityPreferences[key] === true;

    if (reviewMode) {
      control.disabled = true;
      continue;
    }

    control.addEventListener(
      "change",
      () => {
        activityPreferences[key] =
          control.checked === true;
      }
    );
  }
}


function onboardingProgressKey() {
  const uid = auth.currentUser?.uid;
  const personId = onboardingStatus?.personId;
  const campaignId =
    profile?.campaignId || onboardingStatus?.campaignId;

  if (!uid || !personId || !campaignId) return null;

  return `terra-onboarding-progress-v1:${uid}:${campaignId}:${personId}`;
}

function readOnboardingProgress() {
  const key = onboardingProgressKey();
  if (!key) return 0;

  try {
    const raw = localStorage.getItem(key);
    if (raw === null || !/^\d+$/.test(raw)) return 0;

    const step = Number(raw);
    return Number.isSafeInteger(step) &&
      step >= 0 && step < steps.length ? step : 0;
  } catch {
    return 0;
  }
}

function saveOnboardingProgress() {
  if (reviewMode) return;
  const key = onboardingProgressKey();
  if (!key) return;

  try {
    localStorage.setItem(key, String(currentStep));
  } catch {
    console.warn("No se pudo guardar el avance local.");
  }
}

function clearOnboardingProgress() {
  const key = onboardingProgressKey();
  if (!key) return;

  try {
    localStorage.removeItem(key);
  } catch {
    console.warn("No se pudo limpiar el avance local.");
  }
}

function renderStep() {

  const step =
    steps[currentStep];

  stepLabel.textContent =
    step.label;

  title.textContent =
    step.title;

  description.textContent =
    step.description;

  content.innerHTML =
    step.render();

  if (step.key === "activities") {
    bindActivityPreferenceControls();
  }

  if (step.criterion) {
    acknowledgedCriteria.add(
      step.criterion
    );
  }

  saveOnboardingProgress();

  message.textContent =
    "";

  previousButton.hidden =
    currentStep === 0;

  nextButton.disabled =
    false;

  nextButton.textContent =
    currentStep === steps.length - 1
      ? (reviewMode ? "Volver al panel" : "Finalizar")
      : "Continuar";

  window.scrollTo({
    top:
      0,
    behavior:
      "smooth"
  });
}


function buildCriteria() {

  const requiredCriteria = [
    "responsibleKnown",
    "structureKnown",
    "localityKnown",
    "responsibilitiesUnderstood",
    "optionalActivitiesExplained",
    "preferenceCommitmentDistinctionUnderstood",
    "performanceEvaluationExplained",
    "helpAvailable"
  ];

  const criteria = {};

  for (const criterion of requiredCriteria) {
    criteria[criterion] =
      acknowledgedCriteria.has(
        criterion
      );
  }

  return criteria;
}


async function finishOnboarding() {
  if (reviewMode) {
    window.location.replace(reviewHomeDestination());
    return;
  }

  if (
    finishing ||
    !onboardingStatus?.personId
  ) {
    return;
  }

  finishing = true;

  previousButton.disabled =
    true;

  nextButton.disabled =
    true;

  nextButton.textContent =
    "Finalizando...";

  message.textContent =
    "Registrando tu orientación inicial...";

  try {

    const criteria =
      buildCriteria();

    const allCriteriaCompleted =
      Object
        .values(criteria)
        .every(
          value =>
            value === true
        );

    if (!allCriteriaCompleted) {
      throw new Error(
        "Debes recorrer toda la orientación inicial antes de finalizar."
      );
    }

    await completeOnboarding({
      deliveryMode:
        "SELF_SERVICE",

      personId:
        onboardingStatus.personId,

      criteria
    });

    const verification =
      await getMyOnboardingStatus();

    if (
      !verification?.data?.completed
    ) {
      throw new Error(
        "El onboarding no quedó confirmado por el servidor."
      );
    }

    clearOnboardingProgress();

    message.textContent =
      "Primer acceso completado correctamente.";

    window.location.replace(
      destination
    );

  } catch (error) {

    console.error(
      "No fue posible completar onboarding:",
      error
    );

    message.textContent =
      error?.message ||
      "No fue posible completar el primer acceso.";

    previousButton.disabled =
      false;

    nextButton.disabled =
      false;

    nextButton.textContent =
      "Finalizar";

    finishing = false;
  }
}


previousButton.addEventListener(
  "click",
  () => {

    if (
      finishing ||
      currentStep === 0
    ) {
      return;
    }

    currentStep -= 1;
    renderStep();
  }
);


async function saveActivityPreferences() {
  if (reviewMode) return true;
  if (savingActivityPreferences) return false;

  savingActivityPreferences = true;
  previousButton.disabled = true;
  nextButton.disabled = true;
  nextButton.textContent = "Guardando...";
  message.textContent = "Guardando tus preferencias de apoyo...";

  try {
    const result = await updateMyActivityPreferences({
      activityPreferences: { ...activityPreferences }
    });

    if (result?.data?.ok !== true) {
      throw new Error("El servidor no confirmó tus preferencias.");
    }

    message.textContent = "";
    return true;
  } catch (error) {
    console.error("Error al guardar preferencias:", error);
    message.textContent =
      error?.message ||
      "No fue posible guardar tus preferencias. Intenta nuevamente.";
    return false;
  } finally {
    savingActivityPreferences = false;
    previousButton.disabled = false;
    nextButton.disabled = false;
    nextButton.textContent = "Continuar";
  }
}

nextButton.addEventListener(
  "click",
  async () => {

    if (finishing) {
      return;
    }

    if (
      currentStep <
      steps.length - 1
    ) {
      if (steps[currentStep].key === "activities") {
        const preferencesSaved = await saveActivityPreferences();

        if (!preferencesSaved) {
          return;
        }
      }

      currentStep += 1;
      renderStep();
      return;
    }

    await finishOnboarding();
  }
);


logoutButton.addEventListener(
  "click",
  async () => {

    if (finishing) {
      return;
    }

    if (reviewMode) {
      window.location.replace(reviewHomeDestination());
      return;
    }

    await signOut(auth);

    window.location.replace(
      "./login.html"
    );
  }
);


async function initialize(user) {

  if (initialized) {
    return;
  }

  initialized = true;

  try {

    nextButton.disabled =
      true;

    message.textContent =
      "Cargando tu información...";

    const statusResult =
      await getMyOnboardingStatus();

    onboardingStatus =
      statusResult?.data || null;

    if (
      !onboardingStatus ||
      onboardingStatus.ok !== true
    ) {
      throw new Error(
        "No fue posible determinar el estado del primer acceso."
      );
    }

    reviewMode =
      params.get("mode") === "review" &&
      onboardingStatus.applicable === true &&
      onboardingStatus.completed === true;

    if (reviewMode) {
      document.title = "Mi capacitación | TERRA Campaign";

      const heading =
        document.querySelector(".topbar-title h1");

      if (heading) {
        heading.textContent = "Mi capacitación";
      }
      logoutButton.textContent = "Volver al panel";
    }

    if (
      onboardingStatus.applicable === false ||
      (onboardingStatus.completed === true && !reviewMode)
    ) {
      window.location.replace(
        destination
      );

      return;
    }

    const profileSnapshot =
      await getDoc(
        doc(
          db,
          "usuarios",
          user.uid
        )
      );

    if (!profileSnapshot.exists()) {
      throw new Error(
        "Tu perfil territorial no está disponible."
      );
    }

    profile =
      profileSnapshot.data();

    responsibleName =
      await resolveResponsibleName(profile);

    const preferencesResult =
      await getMyActivityPreferences();

    const savedPreferences =
      preferencesResult?.data?.activityPreferences;

    if (
      !savedPreferences ||
      preferencesResult?.data?.ok !== true
    ) {
      throw new Error(
        "No fue posible cargar tus preferencias de apoyo."
      );
    }

    Object.keys(activityPreferences)
      .forEach(key => {
        activityPreferences[key] =
          savedPreferences[key] === true;
      });

    currentStep = reviewMode ? 0 : readOnboardingProgress();

    for (let i = 0; i < currentStep; i += 1) {
      const criterion = steps[i]?.criterion;

      if (criterion) {
        acknowledgedCriteria.add(criterion);
      }
    }

    renderStep();

    if (currentStep > 0) {
      message.textContent =
        "Retomamos tu capacitación desde el último paso guardado en este navegador.";
    }

  } catch (error) {

    console.error(
      "No fue posible iniciar onboarding:",
      error
    );

    initialized =
      false;

    stepLabel.textContent =
      "PRIMER ACCESO";

    title.textContent =
      "No fue posible cargar tu orientación";

    description.textContent =
      "Tu sesión está activa, pero TERRA no pudo preparar la información necesaria.";

    content.innerHTML =
      "";

    message.textContent =
      error?.message ||
      "Intenta nuevamente.";

    previousButton.hidden =
      true;

    nextButton.disabled =
      true;
  }
}


onAuthStateChanged(
  auth,
  user => {

    if (!user) {

      const query =
        window.location.search || "";

      window.location.replace(
        `./login.html${query}`
      );

      return;
    }

    initialize(user);
  }
);
