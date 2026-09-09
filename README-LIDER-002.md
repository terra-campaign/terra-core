# LIDER-002 — Misiones del Líder principal

Base esperada: TERRA Campaign main 7482378, con LIDER-001 y ajuste de misiones sin destinatario. Entrega preparada el 9 de septiembre de 2026. Pendiente de instalación y despliegue por el propietario.

## Alcance

Desde Panel de dirección, la cuenta activa del líder registrado verá «Misiones del Líder principal». La pantalla direccion-misiones.html permite seleccionar de 1 a 50 coordinadores municipales activos de la misma campaña, escribir título, instrucciones y lugar y establecer fecha/hora límite futura. Usa createLinkedMissions y conserva la cadena de delegación hasta participante. El teléfono se toma del campo phone del perfil; puede completarse en el mensaje sin modificar el perfil.

Cada misión guardada ofrece «Comunicar misión por WhatsApp»: muestra el destinatario, número y mensaje editable con instrucciones, fecha, estado y enlace de acceso. Puede abrirse el número completo con código de país o elegirse contacto en WhatsApp. La plataforma no accede a la agenda, no envía automáticamente ni confirma envío o lectura. El responsable completa el envío en WhatsApp.

«Ver avance» muestra asignaciones y evidencias de la cadena. «Revisión de reportes» reutiliza el componente de revisión con descripción, fotografías, decisión, motivo e historial. El líder solo revisa entregas de coordinadores en asignaciones creadas por él. No recibe automáticamente las misiones ni revisiones creadas por el administrador. Los coordinadores conservan parentUserId y la jerarquía existente.

La identidad del líder se comprueba contra principalLeaders en el servidor. El rol por sí solo no autoriza. No se modifican reglas Firestore/Storage; las imágenes del líder se transfieren mediante getMissionReviewImage tras verificar el reporte y su permiso.

Reconsideración: tres horas fijas desde la primera decisión, sin reiniciar el plazo. Solicitar corrección conserva la evidencia original y no reabre vencimientos. No hay superior definido para el líder: sus decisiones quedan bloqueadas después de tres horas; no se muestra solicitud de revisión superior para ellas. Las revisiones superiores existentes de los otros niveles conservan su funcionamiento.

Límites existentes: listado de líderes hasta 5000 perfiles de campaña y 5000 misiones creadas por su UID; bandeja de revisión hasta 500 reportes de campaña. Si se supera el límite, se informa y no se muestran totales parciales. Esta entrega no implementa puntuación, motivación automática, provisión de municipios ni misiones recibidas por el líder.

## Instalación local

Subir terra-lider-002.zip a /home/manuelins891 y ejecutar:

```bash
carpeta_lider_002=$(mktemp -d /home/manuelins891/terra-lider-002.XXXXXX) &&
unzip -q /home/manuelins891/terra-lider-002.zip -d "$carpeta_lider_002" &&
python3 "$carpeta_lider_002/instalar.py" &&
cd ~/terra-core &&
node --test tests/leader-panel.test.cjs tests/leader-missions.test.cjs tests/mission-review.test.cjs
```

El instalador verifica todas las bases antes de escribir, respalda los archivos existentes y restaura en caso de error de copia. No cambia documentos de Firestore ni despliega. Se puede repetir sin duplicar cambios.

## Despliegue tras pruebas locales

```bash
cd ~/terra-core &&
firebase deploy --project terra-campaign --only functions:getPrincipalLeaderMissions,functions:createLinkedMissions,functions:getMissionBranchProgress,functions:getMissionEvidenceTotal,functions:manageMissionLifecycle,functions:getMissionReview,functions:listMissionReviews,functions:decideMissionReview,functions:getMissionReviewImage &&
git add direccion.html direccion.js direccion-misiones.html direccion-misiones.js mission-review-ui.js functions/index.js functions/leader-missions.cjs functions/mission-delegation.cjs functions/mission-review.cjs tests/leader-missions.test.cjs tests/mission-review.test.cjs README-LIDER-002.md &&
git commit -m "Agregar misiones y revision del Lider principal" &&
git push origin main
```

## Validación

42 pruebas de servidor con dobles de Firestore/Auth/Storage aprobadas; sintaxis de los módulos JS comprobada. Cubren permisos, aislamiento de campaña, idempotencia, atomicidad con validación previa a escrituras, cadena hasta participante, vencimiento, cancelación, conteos, revisión solo del creador autorizado, bloqueo a las tres horas, historial y transferencia autenticada de imágenes. Son pruebas simuladas, no pruebas con emulador ni con cuentas de producción.

La comprobación visual automatizada no se pudo ejecutar: Playwright está disponible, pero su navegador Chromium no está instalado. Falta verificar después del despliegue:

1. Entrar como líder y abrir el enlace de misiones; comprobar pantalla en escritorio y teléfono.
2. Guardar una misión de prueba con un coordinador y plazo futuro. Confirmar una asignación y mensaje de guardado.
3. Abrir WhatsApp: confirmar destinatario, número, texto y enlace. Cancelar si solo se está probando; el clic no se registra como envío.
4. Entrar como coordinador, localizar la misión y guardar evidencia antes del vencimiento. Delegar a su jefe de estructura si se desea probar la cadena.
5. Como líder, actualizar revisiones, abrir la entrega, comprobar fotografías y guardar decisión con motivo. Revisar historial y fecha límite de reconsideración.
6. Confirmar que las misiones del administrador siguen bajo revisión del administrador y que el líder no accede a entregas ajenas.

No se autoriza una migración de jerarquía ni un borrado de datos por instalar este paquete.
