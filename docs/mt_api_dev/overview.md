# API de Desarrolladores de MrTurno

La API de desarrolladores de **MrTurno** permite integrar el motor de reservas con aplicaciones externas.

## Recursos principales

- `/branches` – administra sucursales y horarios de atención.
- `/services` – consulta la oferta de servicios disponibles por sucursal.
- `/bookings` – crea, reprograma o cancela turnos.

## Autenticación

Utiliza tokens **JWT** generados desde el panel administrativo de MrTurno. Incluye el encabezado:

```
Authorization: Bearer <token>
```

## Ejemplo de creación de turno

```http
POST /bookings HTTP/1.1
Host: api.mrturno.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "branch_id": "studiocentral",
  "service_id": "depilacion",
  "customer": {
    "name": "Ana",
    "phone": "+595000000"
  },
  "slot": "2024-06-01T14:30:00-04:00"
}
```

## Próximos pasos

- Consulta la [referencia HTML](index.html) para un detalle completo de los campos.
- Revisa los webhooks disponibles en la API de notificaciones.
