# API de Desarrolladores de MrTurno — v2

Esta es la superficie v2 de la DEV-API de MrTurno (`/dev/v2/...`), contrato **2.1**. La usan los integradores que
RAS da de alta para la v2. El contrato completo, con todos los campos, está en la especificación OpenAPI
[`dev-api-v2.yaml`](https://github.com/RENT-A-SOFT-SA/RENT-A-SOFT-SA.github.io/blob/main/docs/mt_api_dev/dev-api-v2.yaml).
Este manual explica los flujos.

## Qué cambia respecto de la v1

- **Rutas propias.** Todo vive bajo `/dev/v2/`. Un servicio habilitado para la v2 no puede usar las rutas v1, y un
  servicio v1 no puede usar estas: la respuesta es `success: false` con un mensaje que lo dice.
- **Agenda sin sesión de paciente.** `POST /dev/v2/turns/free-turn-slots` responde solo con el token de integrador y
  acepta buscar por profesional, por práctica o por una o varias especialidades (`specialty_ids`).
- **La reserva respeta la práctica.** `POST /dev/v2/turns` reserva la práctica que mandás en `practice_id`.
- **Catálogos de RAS Salud.** Prácticas con las sedes y profesionales que las atienden, planes de obra social de la
  clínica y precio particular.
- **Ningún endpoint de negocio envía el código de validación.** Solo `prelogin` y `sign-up` lo envían. Si no hay
  sesión, el resto responde `code: 150`.
- **Turnos de cualquier canal.** `GET /dev/v2/turns/upcoming` lista los turnos próximos del titular y su grupo
  familiar aunque se hayan sacado en el mostrador o por teléfono, con un `turn_id` que sirve para confirmar, cancelar o
  adjuntar (ver "Turnos próximos del paciente").
- **Gestores sin sesión.** Un servicio habilitado puede buscar, dar de alta y reservar para afiliados de terceros sin
  claim `username` (ver "Gestores").
- **Límite por minuto.** 100 pedidos por minuto por servicio e institución. Al superarlo responde HTTP 429 con
  `Retry-After: 60`.

## Ambientes

- Alpha: `https://alpha-api.mrturno.com/dev/v2/`
- Producción: `https://api.mrturno.com/dev/v2/`

### Alpha: teléfonos de prueba

En alpha hay teléfonos ficticios con un código de validación fijo, para automatizar las pruebas del login y del alta
sin un celular real. Pedíselos a RAS. En producción no existen: todo teléfono recibe un código aleatorio.

## Autenticación

JWT RS256 firmado con tu clave privada, en `Authorization: Bearer <token>`, con vigencia de 5 minutos:

```json
{
  "iss": "MRTURNO_<SERVICIO>",
  "sub": "servicio/referencia",
  "iat": 1793210000, "nbf": 1793209880, "exp": 1793210300,
  "institution_id": "<id de la institución en MrTurno>",
  "developer_channel_name": "servicio_whatsapp",
  "username": "+5492615550177"
}
```

- `institution_id` decide la clínica. Un mismo token sirve para varias clínicas cambiando solo este claim, siempre que
  cada clínica haya autorizado el servicio.
- `username` (teléfono en formato E.164 con `+`, o email) identifica al paciente titular. Va en todo lo que opera
  sobre un paciente con sesión; no va en los catálogos ni en la agenda.
- `developer_channel_name` identifica el canal. La sesión del paciente es por canal: si lo cambiás, el paciente tiene
  que volver a validar el código.

## Envelope y errores

```json
{ "success": true, "message": "", "count": 1, "results": { }, "code": null }
```

Los errores de negocio responden HTTP 200 con `success: false`. Usá `code`:

| code | Significado | Qué hacer |
|---:|---|---|
| 10 | Usuario y sesión válidos | Seguir |
| 100 | No existe un usuario con ese `username` | `sign-up` |
| 110 / 111 | Sin sesión: se envió el código por email / WhatsApp | `login` con el código |
| 120 / 130 | Código incorrecto / vencido (dura 10 minutos) | Reintentar `login` / `prelogin` |
| 140 | Paciente inexistente | Darlo de alta |
| 150 | Sin sesión en el canal | `prelogin` |
| 170 | El usuario ya existe | `prelogin` |
| 180 / 181 | Usuario creado: código enviado por email / WhatsApp | `login` |
| 300 | Falta el filtro de la agenda | Mandar profesional, práctica o especialidad |
| 301 | Ventana de fechas inválida | Desde hoy, hasta 14 días |
| 302 | Sede o profesional de otra institución | Usar los ids de los catálogos |
| 303 | Plan no aceptado en la institución | Usar un plan de `social-security-plans` |
| 304 | Demasiadas agendas | Acotar por sede o profesional |
| 305 | Agenda no disponible | Reintentar en unos minutos |
| 306 | La clínica no ofrece online esa prestación federada | Buscar por otra prestación o derivar a la clínica |
| 307 | Fecha de nacimiento inválida o futura | Pedirla de nuevo en formato AAAA-MM-DD |
| 308 | Adjunto inválido (tipo, base64, formato o tamaño); el turno no se reservó | Corregir el adjunto según `message` y reintentar |
| 309 | El turno es de un paciente que no está en el grupo de quien consulta (sin `username`: los afiliados de tu servicio) | Consultarlo con el `username` del paciente titular |
| 311 | `replaces_turn_id` no sirve (no existe, es de otro paciente, ya pasó, no está pendiente ni confirmado, tiene seña); el turno nuevo no se reservó | Ver «Reprogramar» |
| 312 | El endpoint necesita la sesión del paciente (falta el claim `username`) | `prelogin` / `login` del titular y volver a llamar con `username` |
| 313 | La clínica no pudo devolver sus turnos en este momento | Reintentar en unos minutos |
| 1110 / 1111 / 1530 | La clínica rechazó el turno a reprogramar (confirmado y el centro no deja cancelarlo desde Mr. Turno / ya no se puede cancelar / no es de ese paciente o ya pasó); el turno nuevo no se reservó y el anterior sigue igual | Mostrar `message` |
| 0 | Otro error de negocio | Mostrar `message` |

HTTP 401: token inválido o vencido. HTTP 429: límite de pedidos.

## Campos desconocidos

La API **ignora** los campos del pedido que no conoce: no los rechaza ni responde error. Y vos tenés que ignorar los
campos de la respuesta que no conozcas. El contrato crece sumando campos opcionales (los de la versión 2.1, por
ejemplo) sin romper a quien todavía no los usa: no valides las respuestas contra un esquema cerrado.

## Catálogos (sincronizar fuera de la conversación)

| Endpoint | Para qué |
|---|---|
| `GET /institution/subsidiaries` | Sedes |
| `GET /institution/professionals/subsidiary/{id}` | Profesionales de una sede, con `specialty_id` (filtro `?specialty_id=`) |
| `GET /institution/practices` | Prácticas, con las sedes y profesionales que las atienden |
| `GET /institution/social-security-plans` | Planes que se aceptan en la clínica (los que se mandan en agenda y reserva) |
| `GET /institution/social-security-plans/clinical` | Planes de la clínica con tipo (OS, ART, particular) y su plan aceptado si lo tiene |
| `POST /institution/practice-prices` | Precio particular de una o varias prácticas, con IVA |

`practice_id` es el id de la práctica **en cada clínica**: sale de `/institution/practices` y es el que se manda en la
agenda, la reserva y los precios. No es un código global: la misma prestación tiene un `practice_id` distinto en cada
clínica, y el de una clínica no sirve en otra. Sincronizá las prácticas por clínica (por `institution_id`). Los demás
ids (sede, profesional, especialidad, plan, paciente, turno) son de MrTurno.

**Prestación federada (versión 2.1).** Cada práctica trae `federated_practices`: las prestaciones de RAS que la
práctica cubre por turnos online, con `federated_practice_code` (un código común a todas las clínicas, por ejemplo
`RAS-IMG-0003`), `patient_name` (cómo mostrarla) y `terms` (cómo lo dice el paciente: «placa de muñeca»). Sirve para
entender lo que pide el paciente sin mantener un diccionario por clínica. Solo aparecen las que la clínica habilitó
para turnos online.

`code` es el código interno con el que la clínica factura o nomencla la práctica. Sirve para conciliar; **no se le
muestra al paciente**. Al paciente mostrale `name`. Lo mismo vale para el `code` de `/institution/practice-prices`.

Cada profesional de `/institution/practices` trae `specialty_id` (la principal) y `specialty_ids` (todas: un
profesional puede tener más de una especialidad en la misma sede).

**Equipos (E4a).** Un «profesional» puede ser un equipo de imágenes (mamógrafo, rayos, resonancia): viene con
`kind = "equipment"`, el nombre del equipo en `first_name` y `last_name`/`enrolment_number` vacíos. Las personas traen
`kind = "person"`. Para mostrarlo al paciente usá `display_name` («Pérez, Juan» o «Mamografia - Dr. Migliaro Oscar»:
equipo + responsable) en lugar de armar «apellido, nombre». En los turnos los mismos campos van como
`professional_kind` y `professional_display_name`. Son aditivos: `first_name`/`last_name` no cambian.

Solo aparecen las agendas publicadas en MrTurno. `non_federated_count` dice cuántas agendas de la clínica atienden la
práctica pero no se pueden reservar por la API.

## Agenda y reserva

1. `POST /turns/free-turn-slots` con `practice_id` (y/o `professional_id`, `specialty_ids`, `institution_subsidiary_id`),
   `social_security_plan_id`, `start_date` y `end_date`. `specialty_ids` es una lista: trae las agendas de los
   profesionales que tengan **cualquiera** de esas especialidades, y cada grupo dice en `specialty_id` cuál coincidió.
   `specialty_id` (una sola) sigue valiendo: es lo mismo que una lista de una, y si mandás los dos se suman. Responde `groups`, uno por sede y profesional, cada slot con
   `slot_id`, `slot_iso_date`, `slot_hour` y `slot_minutes_duration`. Si una agenda no respondió, va en `errors` y
   `partial` es `true`.

   **Por prestación (versión 2.1).** En lugar de `practice_id` podés mandar `federated_practice_code` (y `visit_type`
   `PRIMERA_VEZ` o `SEGUIMIENTO` en las consultas). Cada agenda resuelve en la clínica qué práctica corresponde —puede
   cambiar por sede o por médico— y su grupo trae `practice_id` (el que vas a mandar al reservar) y `detail`. Si la
   clínica no ofrece esa prestación por turnos online, responde 306.

   **Edad (versión 2.1).** Si todavía no hay paciente con sesión, mandá `patient_birthdate` (AAAA-MM-DD): la clínica
   evalúa con esa fecha las reglas por edad. Una fecha inválida o futura responde 307.

   **Mensajes al paciente (versión 2.1).** Cada grupo trae `patient_messages`: indicaciones que la clínica aprobó para
   el paciente (preparación, qué traer). Mostralas tal cual antes de confirmar la reserva.
2. `POST /turns` con el `free_turn_slot_id` elegido, el `practice_id` del grupo, `patient_id`, `social_security_plan_id`,
   `affiliate_number`, `turn_comment` y, si el grupo trajo `require_institution_policy_flag: true`, el
   `institution_policy_id` con `accept_institution_policy_flag: true`. Un turno por llamada: para varias prácticas,
   una reserva por práctica. Opcional: `attachments` con la orden médica, la autorización o la credencial (ver
   «Adjuntos») y `replaces_turn_id` para reprogramar (ver «Reprogramar»).
3. `POST /turns/confirm-or-cancel` con `turn_id`, `method` (`confirm` | `cancel`) y un `comment` opcional que le llega a
   la clínica. Lo ve en el historial del turno (en RAS: «Ver turno» → «Historial») como «Turno confirmado desde
   MrTurno. Comentario: …» o «Turno cancelado desde MrTurno. Motivo: …». Al confirmar sin `comment` no se agrega
   nada al historial.

**Estado del turno.** `GET /turns/{turn_id}` y los próximos turnos de un paciente (`GET /turns/patient_id/{id}` y
`GET /turns/patient_dni/{dni}`) le piden a la clínica el estado actual antes de responder: un turno que la clínica
canceló sale con `turn_status_description` «Cancelado» y deja de aparecer entre los próximos turnos. Si la clínica no
contesta en ese momento, salen con el último estado que conoce MrTurno.

**Prácticas que ocupan varios horarios.** Si en la clínica la práctica dura más que un horario de la agenda (una
resonancia de 30 minutos en una agenda de 10), mandá un solo `free_turn_slot_id`, el del horario de inicio, con el
`practice_id`: la clínica reserva los horarios seguidos que hagan falta según la duración que tiene configurada para
ese profesional o equipo. No reserves la misma práctica varias veces: el segundo pedido se rechaza porque el paciente
ya tiene turno con ese profesional ese día. Si desde ese inicio no entra (el horario siguiente está ocupado o termina
la agenda), la reserva responde «El horario elegido no alcanza para la duración de la práctica. Elegí otro horario»:
probá con otro inicio. Si la práctica no tiene duración configurada, se reserva un solo horario.

Un turno no se edita: para cambiar fecha, hora, profesional o práctica se **reprograma** en una sola llamada (ver
«Reprogramar»). No canceles primero: si después la reserva nueva falla, el paciente se queda sin turno.

Los turnos que exigen seña no se pueden reservar por la API.

Los datos del paciente no se editan por la API. La obra social y el número de afiliado van en cada reserva
(`social_security_plan_id` y `affiliate_number`): si el paciente cambió de cobertura, mandá la nueva en el turno.

## Reprogramar

`POST /turns` con los datos del turno nuevo, igual que una reserva, más `replaces_turn_id`: el `turn_id` del turno que
el paciente quiere cambiar.

```json
{ "free_turn_slot_id": "…11:00…", "practice_id": "…", "patient_id": "…", "replaces_turn_id": "<turn_id del de las 9:00>", "…": "…" }
```

- **El anterior se cancela sólo si el nuevo quedó reservado.** Si la reserva nueva falla (el horario se ocupó, la
  práctica no entra, lo que sea), el turno anterior queda exactamente como estaba.
- **Sirve en el mismo día y con el mismo profesional o equipo.** Pasar el turno de las 9:00 a las 11:00 del mismo día
  funciona: el turno que se reemplaza no cuenta para el tope de un turno por profesional y día.
- El turno a reemplazar tiene que ser **del mismo paciente** (`patient_id`), de la misma institución, futuro y estar
  pendiente o confirmado. Si está confirmado, el centro tiene que permitir cancelar turnos confirmados desde Mr. Turno.
  Un turno con seña no se reprograma por la API. Si algo de esto no se cumple responde **311** (o 1110 / 1111 / 1530
  si lo rechaza la clínica) y **no** se reserva el turno nuevo.
- La respuesta es la de una reserva más dos campos:

| Campo | Qué es |
|---|---|
| `replaced_turn_id` | El `turn_id` que mandaste en `replaces_turn_id` |
| `replaced` | `true`: el turno anterior quedó cancelado. `false`: el turno nuevo **sí** quedó reservado, pero el anterior sigue activo |
| `replace_error` | Sólo con `replaced: false`: por qué no se canceló el anterior |

Con `replaced: false` avisale al paciente que su turno nuevo está reservado y cancelá el anterior con
`POST /turns/confirm-or-cancel` (`method: cancel`). No debería pasar, pero puede (por ejemplo, la clínica confirmó el
turno anterior en el medio).

Al paciente le llega sólo la confirmación del turno nuevo: el anterior se cancela sin otro aviso de Mr. Turno.

## Adjuntos (orden médica, autorización, credencial)

Los archivos van en base64, en la reserva (`POST /turns`) o después, para un turno ya reservado
(`POST /turns/{turn_id}/attachments`, con el mismo `attachments`). La clínica los ve en los adjuntos del turno.

```json
"attachments": [
  { "type": "medical_order", "content_base64": "/9j/4AAQSkZJRg..." },
  { "type": "credential", "file_name": "Credencial frente", "content_base64": "data:image/png;base64,iVBORw0KGgo..." }
]
```

| Campo | Qué es |
|---|---|
| `type` | `medical_order` (orden médica), `authorization` (autorización), `credential` (credencial) u `other` |
| `content_base64` | El archivo en base64. Acepta el prefijo `data:<tipo>;base64,` |
| `file_name` | Opcional: cómo lo ve la clínica. Sin él: «Orden médica», «Autorización», «Credencial» o «Adjunto» |

- Formatos: JPG, PNG o PDF. El formato se toma del contenido del archivo, no del nombre.
- Hasta 5 adjuntos por llamada y 5 MB cada uno (ya decodificado).
- Se validan **antes** de reservar: si un adjunto está mal, responde 308 y el turno **no** se reserva.
- Con el turno reservado, cada adjunto se guarda en MrTurno y se manda a la clínica. La respuesta trae
  `attachments: [{type, file_name, sent}]`. `sent: false` significa que el turno quedó reservado pero la clínica no
  confirmó haber recibido ese archivo: reintentá sólo ese adjunto con `POST /turns/{turn_id}/attachments`.
- `GET /turns/{turn_id}` trae en `attachments` todo lo que subiste a ese turno (en la reserva y después), del más
  viejo al más nuevo: `[{type, file_name, sent, uploaded_at}]`, con `uploaded_at` en hora de Argentina
  (`AAAA-MM-DD HH:MM:SS`). Son sólo los datos del archivo: ni el contenido ni un link para bajarlo. Si no subiste
  nada, la lista viene vacía. Cada envío es una fila: si reintentaste un adjunto, aparecen los dos intentos. Un adjunto
  que MrTurno no llegó a guardar no aparece.

## Paciente titular (el que escribe por WhatsApp)

1. `GET /security/prelogin` con `username` = teléfono del chat.
2. `code 100` → `POST /security/sign-up` con nombre, apellido, documento, sexo y fecha de nacimiento → `code 181` →
   `POST /security/login` con el código que recibió el paciente.
3. `code 111` → `POST /security/login` con el código.
4. `code 10` → operar. La sesión no se vuelve a pedir en ese canal.

Si el DNI que te da el paciente no coincide con el del titular (`GET /patients/{holder_patient_id}`), está pidiendo
para otra persona: usá un familiar.

## Familiares

Con la sesión del titular: `GET /patients` lista el grupo, `GET /patients/document_number/{dni}` busca un familiar y
`POST /patients/add-kinship` lo da de alta. Después se reserva con el `patient_id` del familiar.

## Turnos próximos del paciente (de cualquier canal)

`GET /turns/upcoming` devuelve los turnos próximos (desde hoy, pendientes o confirmados) del titular y de su grupo
familiar en la clínica del token, **sin importar por dónde se sacaron**: Mr. Turno, tu bot, otro bot, el mostrador o el
teléfono de la clínica. Es el endpoint para «¿qué turnos tengo?» antes de confirmar, cancelar o reprogramar. Hasta 50
turnos, ordenados por fecha y hora.

- **Exige la sesión del titular** (token con `username` de un paciente que validó su código). Sin `username` responde
  `code 312`: no se pueden pedir turnos por un DNI sin sesión, ni con el usuario de gestor.
- Cada turno trae los campos de siempre (los de `GET /turns/{turn_id}`) y además:

| Campo | Qué es |
|---|---|
| `origin` | `mrturno` = reservado en Mr. Turno (web, App o cualquier bot); `center` = sacado en la clínica |
| `manageable` | `true`: el `turn_id` sirve para `GET /turns/{turn_id}`, `POST /turns/confirm-or-cancel` y `POST /turns/{turn_id}/attachments`. `false`: el turno va con datos mínimos y hay que derivar al paciente a la clínica |
| `unmanageable_reason` | Con `manageable: false`: `family_not_verified` (ver privacidad) o `not_in_mrturno` (la clínica no publica en Mr. Turno esa sede o ese profesional) |
| `practices` | Prácticas del turno en la clínica: `[{practice_id, code, name}]` (null con datos mínimos) |

```json
{ "turn_id": "6f1c…", "patient_id": "a2b4…", "turn_date": "2026-11-20 00:00:00", "turn_hour": "09:30:00",
  "institution_subsidiary_name": "Sede Centro", "professional_first_name": "Ana", "professional_last_name": "López",
  "turn_status_description": "Pendiente", "origin": "center", "manageable": true, "unmanageable_reason": null,
  "practices": [{ "practice_id": "c0d1…", "code": "420101", "name": "Consulta" }] }
```

**Privacidad del grupo familiar.** Cualquiera puede agregar un DNI como familiar, así que estar en el grupo no alcanza
para ver los turnos de esa persona en la clínica:

- Los turnos del **titular** van completos.
- Los de un **familiar** van completos sólo si el teléfono que tiene la clínica para el familiar coincide con el del
  titular (se comparan los últimos 10 dígitos, en cualquier formato), o si el familiar ya tiene turnos sacados en
  Mr. Turno desde esta misma cuenta.
- Si no, el turno va con **datos mínimos**: fecha, hora, sede y de qué familiar es, sin `turn_id`, profesional,
  práctica, plan ni estado, con `manageable: false` y `unmanageable_reason: "family_not_verified"`. Decile al paciente
  que lo gestione con la clínica (`institution_subsidiary_phone_number`).

Un turno sacado en la clínica queda registrado en Mr. Turno la primera vez que aparece en este listado, con un
`turn_id` fijo: las llamadas siguientes devuelven el mismo `turn_id` y el estado al día. Registrarlo no le avisa nada
al paciente.

Reprogramar un turno de la clínica es igual que uno de Mr. Turno: reservar el nuevo (`POST /turns`) y, si salió bien,
cancelar el anterior con su `turn_id`.

Los listados `GET /turns/patient_dni/{dni}` y `GET /turns/patient_id/{patient_id}` **siguen mostrando sólo los turnos
sacados por Mr. Turno** (y los de la clínica que ya pasaron por `GET /turns/upcoming`). Para ver todos, usá
`GET /turns/upcoming`.

## Gestores (sin `username`)

Para quien saca turnos para terceros (por ejemplo, un gestor de ART). Requiere que RAS habilite la operación sin
`username` para tu servicio. El token **no** lleva `username`:

1. `GET /patient?document_number={dni}` → `{exists, patient_id, first_name_initial}`, o `code 140` si no está.
2. Si no está: `POST /patient/create` con los datos del afiliado. `phone_number` es obligatorio.
3. Agenda y reserva como arriba, con el `patient_id` del afiliado. Poné los datos del gestor en `turn_comment`.
4. `GET /turns/{turn_id}` y `POST /turns/confirm-or-cancel` también funcionan sin `username`.
   Sólo para los afiliados de tu servicio: un turno de otro paciente (por ejemplo, uno que el titular sacó por su
   WhatsApp) responde `code 309`; consultalo con el `username` del titular.

Los catálogos y la agenda no llevan `username`, así que por defecto muestran lo que la clínica publica para pacientes
de bots. Cuando buscás para un gestor, agregá `acting_as=manager` (en la query o en el cuerpo) a profesionales,
prácticas y agenda: ves lo que la clínica publica para gestores, que es con lo que se valida la reserva sin
`username`.

Los afiliados quedan asociados a tu servicio en esa clínica. Los listados `/patients` no están disponibles sin
`username`.

## Recordatorios

Con el servicio de notificaciones (`MRTURNO_<SERVICIO>_NOTIFICATIONS`), igual que en la v1:

- `POST /notifications/get-turn-notifications-by-institution` devuelve los recordatorios del día siguiente. En la v2
  cada uno trae además `turn_id` y `patient_id` (null si el turno no se reservó por MrTurno), y
  `institution_subsidiary_id` acepta el id de MrTurno de la sede. La lectura marca los recordatorios como enviados:
  llamalo una vez por día y por clínica.
- `POST /notifications/respond-notification` con `notification_id` y `method` (`confirm`, `cancel` o `spam`).
