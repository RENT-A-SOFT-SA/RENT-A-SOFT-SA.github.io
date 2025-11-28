# API de Desarrolladores de MrTurno (MrTurno 5)

Esta documentación describe la API-DEV de **MrTurno 5** orientada a desarrolladores. Incluye autenticación por **JWT RS256**, estructura de respuesta estándar, manejo de errores y la referencia de endpoints por módulo.

## Módulos de la API
- **Seguridad**
- **Institución**
- **Pacientes**
- **Turnos**
- **Notificaciones**

---
## Conceptos clave
- API **REST** con **request/response JSON**.
- **JWT RS256** firmado por el integrador. MrTurno valida firma, ventana de tiempo y `institution_id`.
- Todas las llamadas (salvo `security/status`) requieren enviar el **Bearer token** en `Authorization`.
- El **usuario paciente** inicia sesión vía flujo de verificación por **email/Whatsapp**.
- Las respuestas utilizan un **formato estándar** con `success`, `message`, `code` y `results`.
---

## Ambientes y URLs

- **Sandbox/Alpha**: `https://alpha-api.mrturno.com/dev/`
- **Producción**: `https://api.mrturno.com/dev/`

> Todas las rutas documentadas asumen un prefijo `{API_URL}/dev/` (reemplazar por el ambiente correspondiente).

---

## Autenticación y autorización (JWT RS256)

### Generación de claves

Genere un par RSA en **PEM** y comparta **la pública** con RAS para habilitar su integrador:

```bash
ssh-keygen -t rsa -b 4096 -m PEM -f jwtRS256.key   # sin passphrase
openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
```

### Token JWT

Para todas las peticiones de la API (excepto el método "status") se debe enviar el token JWT con los siguientes parámetros:

```json
{
  "iss": "MRTURNO_<SERVICIO>",
  "sub": "nombre-servicio/referencia-cliente",
  "iat": 1699999999,
  "nbf": 1699999879,
  "exp": 1700000299,
  "institution_id": "4aa8ccd2-3d22-11ea-bb33-963e62249b4a",
  "username": "+5492615792211",
  "developer_channel_name": "servicio_whatsapp"
}
```

- **`iss`**: nombre de usuario asignado por RAS
- **`sub`**: nombre del servicio y una referencia del cliente. Ej: "servicio/demo5"
- **`iat`**: timestamp en el cual fue armado el token. Los tokens son válidos por 5 minutos
- **`nbf`**: timestamp a partir del cual el token es válido. Esto es para reducir el leeway entre servidores. Recomendamos 2 minutos antes del IAT
- **`exp`**: timestamp a partir del cual el token expira. Recomendamos 5 minutos desde el IAT. MrTurno solo toma tokens válidos por 5 minutos
- **`institution_id`**: id de la institución en MrTurno (coordinar con RAS)
- **`username`** (OPCIONAL): número de teléfono o email del usuario registrado en MrTurno5. Es obligatorio para funciones que requieren sesión de usuario y login.
- **`developer_channel_name`**: id del canal utilizado para la sesión. 
  - **Restricciones del canal**: máximo 50 caracteres, sólo caracteres alfanuméricos sin espacio y en minúsculas. Regla PCRE: `[a-z0-9_-]*`. Debe incluir el nombre del developer
  - Ej: "servicio_whatsapp", "servicio_web"
  - Es obligatorio para funciones que requieren sesión de usuario y login

El algoritmo para encriptar el JWT es "RS256". Recordar enviar la clave pública a RAS.


> **Algoritmo:** RS256. Enviar JWT en encabezado `Authorization: Bearer <token>`.

### Encabezados HTTP

```
Authorization: Bearer <jwt>
Content-Type: application/json
Accept: application/json
```
---

## Formato de respuesta estándar

```json
{
  "success": true,
  "message": "OK",
  "count": 0,
  "results": null,
  "code": 0
}
```

- `success`: indica si la operación fue válida.
- `code`: código lógico de la aplicación (ver tabla de códigos).
- `results`: puede ser objeto, array o valor primitivo.

---

## Códigos de respuesta de aplicación

| Code | Success | Mensaje (resumen)                                               | Acción sugerida                        |
|-----:|:-------:|------------------------------------------------------------------|----------------------------------------|
|   10 |  true   | Usuario y sesión válidos                                         | —                                      |
|  100 |  false  | Usuario no encontrado                                            | `security/sign-up`                     |
|  110 |  false  | Sesión no iniciada. Código de verificación enviado por **email** | `security/login`                       |
|  111 |  false  | Sesión no iniciada. Código de verificación enviado por **Whatsapp**   | `security/login`                       |
|  120 |  false  | Código de verificación incorrecto                                | Reintentar `security/login`            |
|  130 |  false  | Token expirado                                                   | Reemitir JWT                           |
|  140 |  false  | Paciente inexistente                                             | Crear/Asociar paciente                 |
|  150 |  false  | Sesión no iniciada                                               | `security/login`                       |
|  160 |  false  | Email ya utilizado                                               | `security/login` / asociar teléfono    |
|  170 |  false  | Usuario ya existe                                                | `security/login`                       |
|  180 |  true   | Usuario creado, código enviado por **email**                     | `security/login`                       |
|  181 |  true   | Usuario creado, código enviado por **Whatsapp**                       | `security/login`                       |
|  190 |  false  | No autorizado para asociar teléfono                               | Revisar alta / soporte                 |
|  200 |  true   | No posee turnos pendientes emitidos por este medio               | —                                      |
|  210 |  false  | Email en blacklist                                               | Contactar soporte                      |

> Los endpoints también retornan **HTTP 200** con `success=false` en ciertos casos lógicos. Use **`code`** para el manejo fino de errores.

---

## Buenas prácticas

- **JWT corto:** expírelos a los 5 min. Recalcule `nbf` ~2 min antes de `iat` para tolerancia de reloj.
- **Idempotencia** al guardar turnos: evite dobles reservas reutilizando `free_turn_slot_id`.
- **Canales**: mantenga un `developer_channel_name` consistente por canal (ej.: `acme_whatsapp`, `acme_web`).

### Organización de API

![Tipos de endpoints](docs/mt_api_dev/api_dev_categorias.png)

### Flujos de sesión de usuario
![Flujos de sesión](docs/mt_api_dev/api_dev_flujos_sesion.png)


---

## Recetas rápidas

### 1) Health check básico (sin JWT)
```bash
curl -sS GET "${API_URL}/dev/security/status"
```

### 2) Ping autenticado
```bash
curl -sS -X POST "${API_URL}/dev/security/ping" \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  -d '{"value":"12345"}'
```

### 3) Flujo de login de paciente
```bash
# 1) Enviar código de verificación
curl -sS GET "${API_URL}/dev/security/prelogin" \
  -H "Authorization: Bearer ${JWT_CON_USERNAME}"

# 2) Confirmar código recibido por el paciente
curl -sS -X POST "${API_URL}/dev/security/login" \
  -H "Authorization: Bearer ${JWT_CON_USERNAME}" \
  -H "Content-Type: application/json" \
  -d '{"token":"123456"}'
```

---

## Referencia de API

### Módulo Seguridad

#### `GET /security/status`
**Descripción:** Verifica que el servicio esté operativo. **No requiere JWT.**  
**Respuesta (`results`):**
```json
"OK - 2025-11-12 10:00:00"
```

---

#### `POST /security/ping`
**Descripción:** Verifica servicio **y** autenticación de institución + usuario desarrollador.  
**Body:**
```json
{ "value": "12345" }
```
**Respuesta (`results`):**
```json
{ "value": "12345" }
```
**cURL:**
```bash
curl -sS -X POST "${API_URL}/dev/security/ping" \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  -d '{"value":"12345"}'
```

---

#### `GET /security/user-status`
**Descripción:** Estado del **usuario paciente** y su sesión (también indica si el titular está federado).  
**Headers:** `Authorization: Bearer <jwt>`

---

#### `GET /security/prelogin`
**Descripción:** Inicia login del paciente. Envía código de verificación (email/Whatsapp).  
**Requiere:** JWT **con `username` y `developer_channel_name`**.  
**Respuestas:** utilizar tabla de **códigos** (110/111, etc.).

---

#### `POST /security/login`
**Descripción:** Finaliza login del paciente con el código enviado por `prelogin`.  
**Body:**
```json
{ "token": "123456" }
```
**Respuesta (`results`):**
```json
{ "holder_patient_id":"123456-2034-11ea-b4d0-782bcbab05d7" }
```
**Errores:** 100, 120, 130, 190.

---

#### `POST /security/logout`
**Descripción:** Cierra la sesión activa del usuario en el **canal** especificado por el JWT.  
**Respuesta:** estándar.

---

#### `POST /security/associate-to-account`
**Descripción:** Asocia un **email** verificado a un usuario para su número de teléfono actual.  
**Body:**
```json
{ "email": "user@example.com" }
```
**Errores:** 160 (email ya utilizado).

---

#### `POST /security/sign-up`
**Descripción:** Alta de **usuario-paciente titular**. Si ya existe por email pero falta asociar el teléfono del JWT, se realiza la asociación. Luego se debe llamar a **`/security/login`**.  
**Body (ejemplo):**
```json
{
  "first_name":"Agustin",
  "last_name":"Giorlando",
  "document_number":"12345478",
  "phone_number":"+5492612246571",
  "email":"giorlandoagustin@gmail.com.ar",
  "gender":10,
  "birthdate":"1994-10-27",
  "social_security_plan_id":"139711e8-f150-11e9-99ff-180373c4d4c1",
  "affiliate_number":"987654321"
}
```

**Catálogos:**
- `gender`:
    - 0=Otro
    - 10=Masculino
    - 20=Femenino

**Respuesta (éxito):**
```json
{
  "success": true,
  "code": null,
  "message": "Usuario creado correctamente, codigo de verificación enviado",
  "count": 1,
  "results": true
}
```
**Códigos asociados:** 160, 170, 180, 181.

---

### Módulo Institución

#### `GET /institution`
**Descripción:** Información general de la institución.  
**Respuesta (`results`):**
```json
{
  "institution_id": "4aa8ccd2-3d22-11ea-bb33-963e62249b4a",
  "name": "RAS Salud 5",
  "policy_html": ""
}
```

---

#### `GET /institution/subsidiaries`
**Descripción:** Sucursales de la institución.  
**Respuesta (`results`):**
```json
[{
  "institution_subsidiary_id": "94da2333-11fd-11ea-aa4e-782bcbab05d7",
  "name": "Calle Peru",
  "phone_number": "+5492612345678",
  "address": "Calle Peru 590",
  "email": "calleperu590@example.com",
  "subsidiary_patient_comment": "comentario de sucursal"
}]
```

---

#### `GET /institution/social-security-plans`
**Descripción:** Obras sociales disponibles en la institución.  
**Respuesta (`results`):**
```json
[{
  "social_security_plan_id":"139711e8-f150-11e9-99ff-180373c4d4c1",
  "name":"ANDES SALUD - BLACK"
}]
```

---

#### `GET /institution/social-security-plans/subsidiary/{subsidiary_id}`
**Descripción:** Obras sociales por sucursal.  
**Respuesta:** igual formato que el endpoint anterior.

---

#### `GET /institution/social-security-plans/professional/{professional_id}/subsidiary/{subsidiary_id}`
**Descripción:** Obras sociales por **profesional** dentro de una sucursal.  
**Respuesta:** igual formato que el endpoint de obras sociales.

---

#### `GET /institution/professionals/subsidiary/{subsidiary_id}`
**Descripción:** Profesionales que atienden en una sucursal.  
**Respuesta (`results`):**
```json
[{
  "professional_id": "bc7ad116-a53a-11ea-a720-de31932e4d21",
  "salutation": "Dr.",
  "first_name": "NO TOCAR",
  "last_name": "MRTURNO PRUEBAS",
  "enrolment_number": "1",
  "specialty_name": "clínica médica",
  "calendar_description": "lunes a domingo 08:00–12:00",
  "professional_patient_comment": "comentario del profesional"
}]
```

---

### Módulo Pacientes

> Todos los endpoints requieren **sesión de usuario** iniciada en el canal del JWT.

#### `GET /patients/{patient_id}`
**Descripción:** Obtiene un paciente por ID.  
**Respuesta (`results`):**
```json
{
  "patient_id": "2ec098c3-2034-11ea-b4d0-782bcbab05d7",
  "patient_first_name": "Pablo",
  "patient_last_name": "Pizarro",
  "patient_document_number": "12345678",
  "social_security_plan_id": "1399bc0d-f150-11e9-99ff-180373c4d4c1",
  "social_security_plan_name": "OSDE - 210",
  "affiliate_type": "obligatorio",
  "affiliate_number": "123",
  "is_holder": true
}

```
**is_holder** indica si el paciente es titular o familiar.

---

#### `GET /patients/document_number/{document_number}`
**Descripción:** Obtiene un paciente por DNI.  
**Respuesta (`results`):**
```json
{
  "patient_id": "2ec098c3-2034-11ea-b4d0-782bcbab05d7",
  "patient_first_name": "Pablo",
  "patient_last_name": "Pizarro",
  "patient_document_number": "12345678",
  "patient_birthdate": "1995-01-01",
  "patient_gender": "",
  "social_security_plan_id": "1399bc0d-f150-11e9-99ff-180373c4d4c1",
  "social_security_plan_name": "OSDE - 210",
  "affiliate_type": "obligatorio",
  "affiliate_number": "123",
  "is_holder": true
}
```

---

#### `GET /patients`
**Descripción:** Lista grupo familiar del usuario.  
**Respuesta (`results`):**
```json
[{
  "id": "bc7ad116-a53a-11ea-a720-de31932e4d21",
  "text": "Pizarro Pablo"
}]
```

---

#### `POST /patients/add-kinship`
**Descripción:** Agrega un familiar al grupo del usuario titular.  
**Body:**
```json
{
  "first_name":"Pepe",
  "last_name":"Hongo",
  "gender":"20",
  "document_number":"34314338",
  "phone_number":"5492618153252",
  "birthdate":"1991-02-25",
  "kinship_type":"30",
  "social_security_plan_id":"1399bc0d-f150-11e9-99ff-180373c4d4c1",
  "affiliate_number":"215896447"
}
```
**Catálogos:**
- `gender`:
    - 0=Otro
    - 10=Masculino
    - 20=Femenino

- `kinship_type`: 
    - 0= Otro
    - 10= Esposo/a
    - 20= Hijo/a
    - 30= Amigo/a
    - 40= Padre/Madre
    - 50= Sobrino/a
    - 60= Nieto/a
    - 70= Abuelo/a
    - 80= Hermano/a
    - 90= Tio/a

**Respuesta (`results`):** igual estructura que `GET /patients/{id}` (el nuevo paciente).

---

### Módulo Turnos

#### `POST /turns/free-turn-slots`
**Descripción:** Consulta **turnos libres** disponibles.  
**Body:**
```json
{
  "institution_subsidiary_id":"505abddd-3d22-11ea-bb33-963e62249b4a",
  "professional_id":"bc7ad116-a53a-11ea-a720-de31932e4d21",
  "social_security_plan_id":"1399bc0d-f150-11e9-99ff-180373c4d4c1",
  "practice_id":"15bb0c18-f1b8-11e9-ba9c-080027ca08d9",
  "start_date":"2020-07-29",
  "end_date":"2020-08-02"
}
```
**Respuesta (`results`):**
```json
{
  "institution_subsidiary_id": "505abddd-3d22-11ea-bb33-963e62249b4a",
  "professional_id": "bc7ad116-a53a-11ea-a720-de31932e4d21",
  "social_security_plan_id": "1399bc0d-f150-11e9-99ff-180373c4d4c1",
  "practice_id": "15bb0c18-f1b8-11e9-ba9c-080027ca08d9",
  "comment_to_patient": ".",
  "institution_policy_url": "https://alpha.mrturno.com/site/view-policy?id=ef6b6074-8a57-11ea-a720-de31932e4d21",
  "institution_policy_id": "ef6b6074-8a57-11ea-a720-de31932e4d21",
  "require_institution_policy_flag": true,
  "free_turn_slot_dtos": [
    {
      "slot_id": "e5e7035a-d67d-11ea-a5b2-0a13a22a5c5d",
      "slot_description": "jueves 06/08 - 8:00 hs (PRESENCIAL)",
      "slot_hour": "8:00",
      "slot_date": "jueves 06/08",
      "slot_modality": "PRESENCIAL",
      "slot_minutes_duration": "15"
    }
  ]
}
```

---

#### `POST /turns`
**Descripción:** **Guarda** (reserva) un turno utilizando un `free_turn_slot_id`.  
**Body:**
```json
{
  "institution_subsidiary_id":"505abddd-3d22-11ea-bb33-963e62249b4a",
  "professional_id":"bc7ad116-a53a-11ea-a720-de31932e4d21",
  "practice_id":"15bb0c18-f1b8-11e9-ba9c-080027ca08d9",
  "social_security_plan_id":"1399bc0d-f150-11e9-99ff-180373c4d4c1",
  "patient_id":"7b689ff3-3b8e-11ea-a922-1a9e6db94361",
  "affiliate_type":"obligatorio",
  "affiliate_number":"0001",
  "free_turn_slot_id":"ccefbb1c-d67d-11ea-b764-782bcbab05d7",
  "turn_comment":"API turn",
  "institution_policy_id":"ee7e5225-9b6d-11ea-82cb-782bcbab05d7",
  "accept_institution_policy_flag": true
}
```
**Respuesta (`results`):**
```json
{
  "turn_id": "0ad07e2a-d73d-11ea-8e5e-0a82e1494d1b",
  "institution_subsidiary_id": "505abddd-3d22-11ea-bb33-963e62249b4a",
  "professional_id": "bc7ad116-a53a-11ea-a720-de31932e4d21",
  "patient_id": "7b689ff3-3b8e-11ea-a922-1a9e6db94361",
  "social_security_plan_id": "1399bc0d-f150-11e9-99ff-180373c4d4c1",
  "institution_name": "RAS Salud 5",
  "institution_subsidiary_name": "Calle Peru",
  "institution_subsidiary_address": "Calle Peru 590",
  "institution_subsidiary_phone_number": "",
  "professional_first_name": "NO TOCAR",
  "professional_last_name": "MRTURNO PRUEBAS",
  "professional_specialty_name": "clínica médica",
  "professional_enrolment_number": "1",
  "patient_first_name": "Pablo Daniel",
  "patient_last_name": "Pizarro",
  "patient_document_number": "27497002",
  "social_security_plan_name": "PARTICULAR - PARTICULAR",
  "turn_date": "2020-08-06",
  "turn_hour": "08:00:00",
  "turn_status_description": "Pendiente",
  "turn_comment": "API turn"
}
```

---

#### `GET /turns/{turn_id}`
**Descripción:** Obtiene un turno por ID.  
**Respuesta:** igual a la de creación.

---

#### `GET /turns/patient_dni/{dni}` y `GET /turns/patient_id/{patient_id}`
**Descripción:** Lista **turnos pendientes** del paciente (por DNI o por ID).  
**Respuesta (`results`):** array de turnos (mismo formato que `GET /turns/{turn_id}`).

---

#### `POST /turns/confirm-or-cancel`
**Descripción:** Confirmar o cancelar un turno específico.  
**Body:**
```json
{
  "turn_id":"44b5dce4-3ed4-11eb-972c-080027471948",
  "comment":"API cancel",
  "method":"cancel"      // "confirm" | "cancel"
}
```
**Respuesta:** `message: "true" | "false"` según resultado.

---

### Módulo Notificaciones

> Integración con recordatorios por **WhatsApp** y confirmaciones/cancelaciones fuera del flujo web.

#### `POST /notifications/{notification_id}`
**Descripción:** Confirmar/cancelar/otros estados de una notificación.  
**Body:**
```json
{
  "method":"confirm",     // "confirm" | "cancel" | "unsubscribe" | "not_sent"
  "comment":"confirmo el turno de mañana"
}
```
**JWT especial (ejemplo):**
```json
{
  "iss": "MRTURNO_SERVICIO_NOTIFICATIONS",
  "sub": "servicio/mrturno",
  "iat": 1663084684,
  "nbf": 1663084564,
  "exp": 1673084984,
  "institution_id": "4f5ce136-6cee-11ed-9b43-0aa09875696d",
  "username": "soporte@mrturno.com",
  "developer_channel_name": "servicio_whatsapp"
}
```

---

#### `POST /notifications/get-turn-notifications-by-institution`
**Descripción:** Devuelve notificaciones pendientes para una institución y fecha dadas.  
**Body:**
```json
{
  "institution_subsidiary_id":"ae110249-82f1-11ee-9e19-0242ac120003",
  "notification_date":"2023-11-30"
}
```
**Respuesta (`results`):**
```json
[{
  "id": "08977aed-8edc-11ee-a97f-0242ac145473",
  "external_turn_id": "1e18f216-8eaf-11ee-9495-0a394db502dd",
  "patient_first_name": "Agustin",
  "patient_last_name": "GIORLANDO BARDARO",
  "patient_phone_number": "+5492612189550",
  "professional_first_name": "NO TOCAR",
  "professional_last_name": "MRTURNO PRUEBAS",
  "professional_specialty_name": "CLINICA MEDICA",
  "turn_date": "2023-11-30",
  "turn_hour": "10:30:00",
  "turn_comment_to_patient": "<p>…</p>"
}]
```

---

## Glosario

- **Canal**: Origen de la sesión (ej.: `whatsapp`, `web`). Se representa en `developer_channel_name`.
- **Plan de obra social**: Cobertura médica con `social_security_plan_id`.
- **Titular**: Paciente dueño de la cuenta (holder).

---
