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
- **Gestores sin sesión.** Un servicio habilitado puede buscar, dar de alta y reservar para afiliados de terceros sin
  claim `username` (ver "Gestores").
- **Límite por minuto.** 100 pedidos por minuto por servicio e institución. Al superarlo responde HTTP 429 con
  `Retry-After: 60`.

## Ambientes

- Alpha: `https://alpha-api.mrturno.com/dev/v2/`
- Producción: `https://api.mrturno.com/dev/v2/`

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
   una reserva por práctica.
3. `POST /turns/confirm-or-cancel` con `turn_id`, `method` (`confirm` | `cancel`) y un `comment` opcional que le llega a
   la clínica.

Reprogramar es reservar el turno nuevo y, si salió bien, cancelar el anterior.

Los turnos que exigen seña no se pueden reservar por la API.

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

## Gestores (sin `username`)

Para quien saca turnos para terceros (por ejemplo, un gestor de ART). Requiere que RAS habilite la operación sin
`username` para tu servicio. El token **no** lleva `username`:

1. `GET /patient?document_number={dni}` → `{exists, patient_id, first_name_initial}`, o `code 140` si no está.
2. Si no está: `POST /patient/create` con los datos del afiliado. `phone_number` es obligatorio.
3. Agenda y reserva como arriba, con el `patient_id` del afiliado. Poné los datos del gestor en `turn_comment`.
4. `GET /turns/{turn_id}` y `POST /turns/confirm-or-cancel` también funcionan sin `username`.

Los afiliados quedan asociados a tu servicio en esa clínica. Los listados `/patients` no están disponibles sin
`username`.

## Recordatorios

Con el servicio de notificaciones (`MRTURNO_<SERVICIO>_NOTIFICATIONS`), igual que en la v1:

- `POST /notifications/get-turn-notifications-by-institution` devuelve los recordatorios del día siguiente. En la v2
  cada uno trae además `turn_id` y `patient_id` (null si el turno no se reservó por MrTurno), y
  `institution_subsidiary_id` acepta el id de MrTurno de la sede. La lectura marca los recordatorios como enviados:
  llamalo una vez por día y por clínica.
- `POST /notifications/respond-notification` con `notification_id` y `method` (`confirm`, `cancel` o `spam`).
