# API-DEV: Notificaciones Múltiples — MrTurno

> Documento de referencia técnica para integrar el flujo de recordatorios y confirmaciones/cancelaciones de turnos vía notificaciones. Orientado a desarrolladores backend y frontend.

**Versión:** 1.0 • **Actualizado:** 2025-11-12

---

## Índice

- [Introducción](#introducción)
- [Ambientes y URLs](#ambientes-y-urls)
- [Autenticación](#autenticación)
- [Estructura de respuesta estándar](#estructura-de-respuesta-estándar)
- [Prerrequisitos](#prerrequisitos)
- [Endpoints](#endpoints)
  - [Obtener notificaciones por institución](#post-devnotificationsget-turn-notifications-by-institution)
  - [Registrar respuesta de notificación](#post-devnotificationsrespond-notification)
  - [Confirmar/Cancelar por ID de notificación](#post-devnotificationsnotification_id)
- [Flujo de integración recomendado](#flujo-de-integración-recomendado)
- [Buenas prácticas de integración](#buenas-prácticas-de-integración)
- [Ejemplos rápidos (curl / Postman)](#ejemplos-rápidos-curl--postman)
- [Límites de uso](#límites-de-uso)
- [Seguridad y cumplimiento](#seguridad-y-cumplimiento)
- [Solución de problemas](#solución-de-problemas)
- [Glosario](#glosario)

---

## Introducción

La API de **Notificaciones Múltiples** permite a sistemas externos obtener el lote de recordatorios de turnos pendientes y registrar las respuestas de pacientes (confirmar, cancelar, spam, etc.). Está pensada para orquestar envíos (p. ej., WhatsApp/SMS/Email) y consolidar el feedback del paciente en MrTurno.

Casos de uso principales:

- Obtener notificaciones de turnos por institución y/o sucursal para una fecha.
- Generar mensajes a partir de los datos provistos (paciente, profesional, horarios, URLs de confirmación/cancelación).
- Registrar la respuesta del paciente desde un canal externo.
- Confirmar o cancelar directamente por ID de notificación cuando el canal no soporte el endpoint de respuesta.

---

## Ambientes y URLs

- **Alpha (testing):** `https://api.alpha.mrturno.com/dev/`
- **Producción:** `https://api.mrturno.com/dev/`

Todas las peticiones son REST con `Content-Type: application/json` y se transmiten sobre HTTPS.

> **Nota:** Si ves URLs legadas en documentación previa, priorizá las de esta guía para nuevas integraciones.

---

## Autenticación

La API utiliza **Bearer Token** (JWT o similar). Incluí el encabezado HTTP en **todas** las solicitudes:

```
Authorization: Bearer <YOUR_API_TOKEN>
```

Consideraciones:
- Renová el token antes de su expiración según tu proveedor de credenciales.
- No expongas el token en clientes públicos. Usá un backend propio para firmar y retransmitir.
- Ante `401 Unauthorized`, verificá la vigencia del token y el formato del encabezado.

---

## Estructura de respuesta estándar

Todas las respuestas siguen un **envoltorio estándar**:

```json
{
  "success": true,
  "message": "OK",
  "count": 0,
  "results": null,
  "code": 110
}
```

- `success`: booleano de éxito de la operación.
- `message`: texto informativo o de error.
- `count`: cantidad de elementos en `results` (cuando aplica).
- `results`: objeto/array con el resultado.
- `code`: código interno de estado (para mapeos y diagnósticos).

---

## Prerrequisitos

- Usuario **desarrollador** registrado.
- Un **servicio** asociado a ese usuario.
- El servicio con **access point** habilitado para la institución correspondiente.

---

## Endpoints

### `POST /dev/notifications/get-turn-notifications-by-institution`

Obtiene las **notificaciones de turnos pendientes** para una institución (y opcionalmente una sucursal) en una fecha dada.

**Headers**

```
Content-Type: application/json
Authorization: Bearer <YOUR_API_TOKEN>
```

**Body (JSON)**

```json
{
  "institution_subsidiary_id": "uuid-opcional-de-sucursal",
  "notification_date": "2025-11-12"
}
```

**Campos**
- `institution_subsidiary_id` *(opcional)*: Filtra por sucursal; si se omite, devuelve todas las sucursales de la institución asociada al access point.
- `notification_date` *(opcional)*: Formato `YYYY-MM-DD`. Si se omite, se asume la fecha actual del sistema.

**Response (200)**

```json
{
  "success": true,
  "code": 200,
  "message": "OK",
  "count": 2,
  "results": [
    {
      "id": "notification-uuid-123",
      "patient_first_name": "Juan",
      "patient_last_name": "Pérez",
      "patient_phone_number": "+541234567890",
      "professional_first_name": "María",
      "professional_last_name": "García",
      "professional_specialty_name": "Cardiología",
      "turn_date": "2025-11-13",
      "turn_hour": "10:30",
      "turn_comment_to_patient": "Traer estudios previos",
      "subsidiary_name": "Sede Centro",
      "subsidiary_address": "Av. Principal 123",
      "confirm_url": "https://mrturno5.com/notification/turn-confirm-or-cancel?token=xyz&option=confirm&source=whatsapp",
      "cancel_url": "https://mrturno5.com/notification/turn-confirm-or-cancel?token=xyz&option=cancel&source=whatsapp",
      "institution_url": "https://mrturno5.com/clinica-ejemplo",
      "footer": "Mensaje personalizado de la institución"
    },
    {
      "id": "notification-uuid-456",
      "patient_first_name": "Ana",
      "patient_last_name": "López",
      "patient_phone_number": "+5492615558888",
      "professional_first_name": "Jorge",
      "professional_last_name": "Suárez",
      "professional_specialty_name": "Dermatología",
      "turn_date": "2025-11-13",
      "turn_hour": "15:00",
      "turn_comment_to_patient": null,
      "subsidiary_name": "Sede Sur",
      "subsidiary_address": "Calle Falsa 742",
      "confirm_url": "https://mrturno5.com/notification/turn-confirm-or-cancel?token=abc&option=confirm&source=sms",
      "cancel_url": "https://mrturno5.com/notification/turn-confirm-or-cancel?token=abc&option=cancel&source=sms",
      "institution_url": "https://mrturno5.com/dermato-sur",
      "footer": null
    }
  ]
}
```

**Errores comunes**

- `400 Bad Request`: fecha con formato inválido, JSON malformado.
- `401 Unauthorized`: token inválido o expirado.
- `403 Forbidden`: servicio sin permisos para la institución/sucursal.
- `404 Not Found`: no existen notificaciones para los filtros indicados.
- `429 Too Many Requests`: límite de tasa excedido.
- `500 Internal Server Error`: error inesperado del servidor.

---

### `POST /dev/notifications/respond-notification`

Registra la **respuesta del paciente** a una notificación (confirmar/cancelar/spam).

**Headers**

```
Content-Type: application/json
Authorization: Bearer <YOUR_API_TOKEN>
```

**Body (JSON)**

```json
{
  "notification_id": "notification-uuid-123",
  "method": "confirm",
  "comment": "Paciente confirma asistencia"
}
```

**Campos**
- `notification_id` *(obligatorio)*: ID entregado por el endpoint de obtención.
- `method` *(obligatorio)*: `confirm` | `cancel` | `spam`.
- `comment` *(opcional)*: Texto libre (máx. 255).

**Response (200)**

```json
{
  "success": true,
  "code": 200,
  "message": "OK",
  "count": 1,
  "results": true
}
```

**Errores comunes**

- `400 Bad Request`: `notification_id` ausente o método inválido.
- `401 Unauthorized`: token inválido o expirado.
- `404 Not Found`: `notification_id` inexistente o no asociado al servicio.
- `409 Conflict`: la notificación ya fue respondida con un estado final.
- `422 Unprocessable Entity`: comentario excede longitud o caracteres inválidos.
- `500 Internal Server Error`.

---

### `POST /dev/notifications/{notification_id}`

Confirma o cancela un turno **directamente por ID de notificación** (flujo histórico). Útil cuando la confirmación/cancelación llega desde un canal que **no** utiliza `respond-notification`.

**Path Params**
- `notification_id` *(obligatorio)*

**Headers**

```
Content-Type: application/json
Authorization: Bearer <YOUR_API_TOKEN>
```

**Body (JSON)**

```json
{
  "method": "confirm",
  "comment": "confirmo el turno de mañana"
}
```

**Valores admitidos en `method`**
- `confirm`
- `cancel`
- `unsubscribe` (el paciente solicita no recibir más mensajes)
- `not_sent` (marcar como no entregado por motivo externo)

**Response (200)**

```json
{ "success": true, "code": 200, "message": "OK", "count": 1, "results": true }
```

**Errores comunes**

- `400 Bad Request`: método no permitido.
- `401 Unauthorized`: token inválido o expirado.
- `404 Not Found`: ID inexistente.
- `409 Conflict`: estado previo incompatible (p. ej., ya cancelado).
- `500 Internal Server Error`.

---

## Flujo de integración recomendado

1. **Autenticación**: configurar el *Bearer Token* en tu cliente HTTP.
2. **Obtener notificaciones**: llamar a `get-turn-notifications-by-institution` para la fecha objetivo.
3. **Componer y enviar mensajes**: usar los campos del `results` (incluye `confirm_url` y `cancel_url`) para armar la plantilla en WhatsApp/SMS/Email.
4. **Registrar respuestas**: cuando el paciente interactúa, llamar `respond-notification` (o el endpoint por ID si aplica).
5. **Monitoreo**: registrar métricas de entrega, respuesta y error por canal para diagnóstico y mejoras.

---

## Buenas prácticas de integración

- **Idempotencia de tu lado**: si tu orquestador reintenta, usá una clave idempotente propia y considerá `results: true` como operación aplicada.
- **Protección de enlaces**: las URLs de confirmación/cancelación son para el **usuario final**; para registrar acciones, usá el endpoint de **respuesta**.
- **Validaciones previas**: validá formato `YYYY-MM-DD` en `notification_date` y tipos antes de invocar el API.
- **Tiempos y ventanas**: programá obtención y envío con suficiente anticipación al turno (p. ej., día anterior y el mismo día).
- **Observabilidad**: logueá `code`, `message`, y request-id (si está disponible) para correlación y soporte.
- **Backoff exponencial**: ante `429` implementá reintentos con *jitter* y respetá `Retry-After` si es provisto.

---

## Ejemplos rápidos (curl / Postman)

### 1) Obtener notificaciones del día

```bash
curl -X POST "https://api.alpha.mrturno.com/dev/notifications/get-turn-notifications-by-institution" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institution_subsidiary_id": null,
    "notification_date": "2025-11-12"
  }'
```

### 2) Registrar respuesta (confirmar)

```bash
curl -X POST "https://api.alpha.mrturno.com/dev/notifications/respond-notification" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notification_id": "notification-uuid-123",
    "method": "confirm",
    "comment": "Confirmo asistencia"
  }'
```

### 3) Confirmar/cancelar por ID de notificación

```bash
curl -X POST "https://api.alpha.mrturno.com/dev/notifications/notification-uuid-123" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "cancel",
    "comment": "No puedo asistir"
  }'
```

> **Postman**: Podés importar estas llamadas como *raw requests*. Si preferís, solicitá una **colección Postman** y la generamos con variables de entorno para `TOKEN` y `BASE_URL`.

---

## Límites de uso

- Límite de **peticiones por minuto (RPM)** por servicio (consultar contrato o cabeceras de rate-limit si están habilitadas).
- Tamaño de respuesta: el endpoint de obtención puede retornar **cientos** de notificaciones; si necesitás paginación, contactá a soporte para habilitarla.
- Tamaño de `comment`: recomendado **<= 255** caracteres.

---

## Seguridad y cumplimiento

- **HTTPS obligatorio** en todos los ambientes.
- Rotación periódica del **Bearer Token** y almacenamiento cifrado (KMS/Vault).
- No persistir **datos sensibles** innecesariamente; anonimizar logs de PII (teléfonos, nombres).
- Respetar las **preferencias de contacto** del paciente (`unsubscribe`).

---

## Solución de problemas

- **401 Unauthorized**: verificá formato del encabezado y vigencia del token. Probá refrescar credenciales.
- **403 Forbidden**: confirmá que el servicio tenga permisos sobre la institución/sucursal.
- **404 Not Found**: revisá filtros, fecha y alcance de la institución.
- **409 Conflict**: la notificación ya tiene un estado final; tratá la respuesta como informativa.
- **429 Too Many Requests**: implementá backoff exponencial y respetá *Retry-After*.
- **5xx**: reintentá con *circuit breaker* y alertá a soporte si persiste.

---

## Glosario

- **Notification**: entidad que representa un recordatorio de turno con datos del paciente/profesional y enlaces de acción (confirmación/cancelación).
- **Institution Subsidiary**: sucursal de la institución médica; puede filtrarse al obtener notificaciones.
- **Access Point**: vínculo entre un servicio y una institución/sucursal que habilita el acceso a sus datos.
