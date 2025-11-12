# API de Métricas - Analytics Suite

La API de Métricas ofrece indicadores en tiempo real para tableros y reportes personalizados.

## Características

- Estadísticas de uso minuto a minuto.
- Filtros por producto, canal y segmento de clientes.
- Entrega de datos en formato JSON y CSV.

## Autenticación

1. Solicita un `client_id` y `client_secret` al equipo de cuentas.
2. Obtén un token OAuth 2.0 con el flujo Client Credentials en `POST /oauth/token`.
3. Envía el token en el encabezado `Authorization` de cada solicitud.

## Endpoints clave

| Endpoint | Descripción |
|----------|-------------|
| `/metrics/summary` | Indicadores principales agregados. |
| `/metrics/timeseries` | Serie temporal de métricas personalizadas. |
| `/exports` | Descarga CSV con métricas crudas. |

## Ejemplo de petición

```bash
curl -H "Authorization: Bearer $TOKEN" \
     "https://analytics.rentasoft.com/api/v1/metrics/summary?product=mrturno"
```

## Recursos relacionados

- Documentación de autenticación avanzada en `docs/analytics/auth.html`.
- Plantillas de tableros en el repositorio interno de BI.
