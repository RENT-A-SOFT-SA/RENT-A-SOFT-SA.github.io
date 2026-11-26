# API-DEV: Notificaciones Múltiples — MrTurno

> Documento de referencia técnica para integrar el flujo de recordatorios y confirmaciones/cancelaciones de turnos vía notificaciones. Orientado a desarrolladores externos a la empresa.

---
## Introducción

La API de **Notificaciones Múltiples** permite a sistemas externos obtener un lote de recordatorios de turnos pendientes y registrar las respuestas de pacientes (confirmar, cancelar, spam, etc.). Está pensada para orquestar envíos (p. ej., WhatsApp/SMS/Email) y consolidar el la respuesta del paciente en MrTurno y RAS Salud.

Casos de uso principales:

- Obtener notificaciones de turnos por institución y/o sucursal para una fecha.
- Generar mensajes a partir de los datos provistos (paciente, profesional, horarios, URLs de confirmación/cancelación).
- Registrar la respuesta del paciente desde un canal externo.
- Confirmar o cancelar directamente por ID de notificación.

---

## Ambientes y URLs

- **Alpha (testing):** `https://alpha-api.mrturno.com/dev/`
- **Producción:** `https://api.mrturno.com/dev/`

Todas las peticiones son REST con `Content-Type: application/json` y se transmiten sobre HTTPS.

---

## Autenticación

La API utiliza **Bearer Token** (JWT o similar). Incluí el encabezado HTTP en **todas** las solicitudes:

```
Authorization: Bearer <YOUR_API_TOKEN>
```


### Consideraciones:
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

**Errores**

Los errores de negocio vuelven con **HTTP 200** y `success: false`, con el motivo en `message`. Revisá siempre `success`, no sólo el código HTTP. Los más frecuentes:

- `No se han encontrado notificaciones`: no hay recordatorios para enviar en esa fecha. No es una falla: no hay nada que mandar.
- `No se han encontrado notificaciones válidas`: había recordatorios, pero ninguno con un celular utilizable (esos quedan descartados).
- `No se encuentra un access point asociado` o `No se ha encontrado un access point para la institucion`: el servicio no está habilitado para esa institución.
- `No tiene acceso a ese servicio en la institucion`: la clave del token no está vinculada a esa institución.
- `No se encuentra la sucursal` o `La sucursal indicada no pertenece a la institución`: revisá `institution_subsidiary_id`.
- Errores de validación de `notification_date` (formato `YYYY-MM-DD`) o de `institution_subsidiary_id`.

Códigos HTTP distintos de 200:

- `401 Unauthorized`: token ausente, vencido o con una firma que no corresponde a la clave registrada.
- `429 Too Many Requests`: se superó el límite diario de requests para el par servicio-institución.
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
    - `confirm`: Confirma asistencia al turno. En algunas instituciones, una vez confirmado ya no se puede cancelar posteriormente.
    - `cancel`: Cancela el turno y queda disponible para que pueda ser ocupado por otro paciente.
    - `spam`: Agrega al paciente a una lista para que no se le envíen más notificaciones automáticas.
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

**Errores**

Igual que en el endpoint anterior, los errores de negocio vuelven con **HTTP 200** y `success: false`, con el motivo en `message`:

- `No se encuentra la notificación`: el `notification_id` no existe o no pertenece a tu servicio y a la institución del token.
- `La fecha y hora del turno ya ha pasado. No es posible confirmar o cancelar un turno anterior a la fecha actual.`
- `No se encuentra el turno en RAS Salud`: el turno ya no existe en el sistema del centro.
- Rechazos del sistema del centro, con su propio mensaje: por ejemplo, cancelar un turno ya confirmado cuando el centro no lo permite.
- Errores de validación: `notification_id` o `method` ausentes, `method` distinto de `confirm`, `cancel` o `spam`, o `comment` de más de 255 caracteres.

Confirmar un turno que ya estaba confirmado no es un error: la respuesta es exitosa.

Códigos HTTP distintos de 200: `401 Unauthorized`, `429 Too Many Requests` y `500 Internal Server Error`, como en el endpoint anterior.

---

## Flujo de integración recomendado

1. **Autenticación**: configurar el *Bearer Token* en tu cliente HTTP.
2. **Obtener notificaciones**: llamar a `get-turn-notifications-by-institution` para la fecha objetivo.
3. **Componer y enviar mensajes**: usar los campos del `results` (incluye `confirm_url` y `cancel_url`) para armar la plantilla.
4. **Registrar respuestas**: cuando el paciente interactúa, llamar `respond-notification`.

![Diagrama del flujo de notificaciones](docs/mt_api_dev/secuencia_notificaciones_multiples.png)

---

## Buenas prácticas de integración

### Manejo de errores y reintentos
- Revisá `success` en cada respuesta: los errores de negocio vuelven con HTTP 200 y `success: false`.
- Implementá **backoff exponencial** para reintentos en errores `5xx`.
- Ante un `429`, no reintentes en el día: el límite es diario por servicio e institución.
- Logeá las respuestas con `success: false` para auditoría, pero no las reintentes automáticamente.

### Optimización de rendimiento
- Realizá llamadas a `get-turn-notifications-by-institution` **una vez por día** y por institución.
- Almacená localmente las notificaciones obtenidas para evitar llamadas repetitivas.
- Usá **pooling de conexiones HTTP** para múltiples requests.

### Seguridad
- **Nunca** expongas el token de API en clientes frontend.
- Rotá tokens regularmente según las políticas de tu organización.
- Validá y sanitizá todos los inputs antes de enviarlos a la API.

### Monitoreo
- Implementá métricas para detectar fallos de integración.
- Alertá cuando la tasa de errores `4xx/5xx` supere umbrales.
- Monitoreá latencias de respuesta para detectar degradación.

---

## Ejemplos rápidos (curl / Postman)

### 1) Obtener notificaciones del día

```bash
curl -X POST "https://alpha-api.mrturno.com/dev/notifications/get-turn-notifications-by-institution" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institution_subsidiary_id": null,
    "notification_date": "2025-11-12"
  }'
```

### 2) Registrar respuesta (confirmar)

```bash
curl -X POST "https://alpha-api.mrturno.com/dev/notifications/respond-notification" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notification_id": "notification-uuid-123",
    "method": "confirm",
    "comment": "Confirmo asistencia"
  }'
```

---

## Límites de uso

### Rate Limiting
- **100 requests por minuto** por token de API.
- **1,000 requests por día** por servicio.
- Los límites se resetean cada minuto/día según corresponda.

### Limites de datos
- Máximo **500 notificaciones** por respuesta en `get-turn-notifications-by-institution`.
- Comentarios limitados a **255 caracteres**.
- Timeout de **30 segundos** por request.

### Políticas de uso
- No realizar polling continuo; usar intervalos de **al menos 1 hora**.
- Los datos de notificaciones son válidos por **24 horas** desde su generación.
- Respetar ventanas de mantenimiento programado (notificadas con 48hs de anticipación).

### Excepciones y escalamiento
Para solicitar límites superiores, contactá a soporte técnico con:
- Justificación del caso de uso.
- Volumen estimado de requests.
- Información de la institución y el servicio integrador.

---

## Seguridad y cumplimiento

### Protección de datos
- Todos los datos se transmiten por **HTTPS/TLS 1.2+**.
- Los datos de pacientes están sujetos a normativas de **protección de datos personales**.
- No almacenes información sensible (números de teléfono, nombres) por más tiempo del necesario.

### Cumplimiento normativo
- La API cumple con estándares de **seguridad en salud**.
- Logs de auditoría se mantienen por **2 años**.
- Acceso restringido por **principio de menor privilegio**.

### Responsabilidades del integrador
- **Cifrar** datos sensibles en tránsito y reposo.
- Implementar **autenticación fuerte** en tus sistemas.
- **Auditar** accesos y cambios en configuraciones.
- **Notificar** incidentes de seguridad en un plazo de 24 horas.

### Incident response
Ante sospecha de compromiso de seguridad:
1. **Revocar inmediatamente** el token comprometido.
2. **Notificar** a soporte técnico: security@mrturno.com
3. **Documentar** el incidente para investigación.
4. **Generar** un nuevo token una vez resuelto el incidente.

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
