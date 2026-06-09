# DEV-API Session v2 · Inicio de implementación

Este documento inicia la implementación de **Session v2** para el flujo de autenticación de usuario paciente en MrTurno.

## Objetivo de esta etapa

Implementar el flujo base de login en tres pasos:

1. **Pre-validación de usuario** con `GET /security/prelogin`
2. **Alta opcional** de usuario con `POST /security/sign-up` (si no existe)
3. **Confirmación de login** con `POST /security/login`

## Requisitos de token JWT

Para Session v2, el JWT debe incluir:

- `institution_id`
- `username`
- `developer_channel_name`

> Se recomienda mantener una validez corta (5 minutos) y usar `RS256`.

## Secuencia mínima de implementación

### 1) Prelogin

Solicita envío de código de verificación por email o WhatsApp.

```bash
curl -X GET "https://api.mrturno.com/dev/security/prelogin" \
  -H "Authorization: ******"
```

### 2) Sign-up (si aplica)

Si `prelogin` indica usuario inexistente (`code: 100`), crear usuario:

```bash
curl -X POST "https://api.mrturno.com/dev/security/sign-up" \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Ana",
    "last_name": "Pérez",
    "document_number": "30111222",
    "email": "ana@example.com"
  }'
```

### 3) Login

Finaliza sesión enviando el código recibido por el usuario:

```bash
curl -X POST "https://api.mrturno.com/dev/security/login" \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'
```

## Criterios de aceptación de inicio

- El flujo responde correctamente para códigos de negocio `110/111/10`.
- El canal (`developer_channel_name`) permanece estable durante toda la sesión.
- Luego de login exitoso, se pueden consumir endpoints con sesión de usuario (por ejemplo `/patients`).

## Próximo incremento

- Implementar manejo de errores y reintentos (`120`, `130`, `150`).
- Agregar trazabilidad por canal y usuario para auditoría.
