# Fase 2 — Envíos automáticos por WhatsApp

Mensajes que salen desde el WhatsApp de cada organización a SUS clientes.
Todos son **best-effort**: si el gateway falla o la org no está conectada, la
cita igual se crea/edita (no se rompe nada).

## Disparadores

| Evento | Dónde | Mensaje |
|--------|-------|---------|
| Crear cita interna | `createAppointment` (`actions/appointments.ts`) | Confirmación |
| Reserva pública | `notifyPublicBooking` ← `booking-flow.tsx` tras el RPC | Confirmación |
| Cancelar cita | `updateAppointmentStatus(status="cancelled")` | Cancelación (+ motivo) |
| Reagendar | `rescheduleAppointment` | Nueva fecha |
| Recordatorio | cron `GET /api/cron/reminders` | Recordatorio (24h antes) |
| Manual | menú Acciones → "Enviar recordatorio" | Recordatorio |

Plantillas y normalización de número (Ecuador `+593`) en `src/lib/whatsapp/notify.ts`
y `toChatId` en `src/lib/whatsapp/client.ts`.

## Requisitos para que un envío salga

1. La org tiene su WhatsApp **conectado** (`whatsapp_connections.status = 'connected'`).
2. El cliente tiene **teléfono** registrado.
3. `OPENWA_URL` / `OPENWA_API_KEY` configurados.

## Recordatorios (cron)

La ruta busca citas `pending`/`confirmed` que empiezan en las próximas 24h y
sin `reminder_sent_at`, manda el recordatorio y marca la columna (idempotente).

### Probar en dev
```bash
curl "http://localhost:3000/api/cron/reminders?token=TU_CRON_SECRET"
# -> {"ok":true,"processed":N,"sent":M}
```

### Producción
- **Vercel:** `vercel.json` ya define el cron cada hora. Pon `CRON_SECRET` en las
  env vars del proyecto en Vercel; Vercel manda el header `Authorization` solo.
- **Cron externo** (cron-job.org, etc.): programa cada hora un GET a
  `https://TU_DOMINIO/api/cron/reminders?token=CRON_SECRET`.
- **Desde la VM** (siempre encendida): `crontab -e` y agregar:
  ```
  0 * * * * curl -s "https://TU_DOMINIO/api/cron/reminders?token=CRON_SECRET" >/dev/null
  ```

> Nota: en dev con ngrok los recordatorios solo corren si tu PC + dev server +
> ngrok están encendidos. Para 24/7 real, despliega agenda-pro (Vercel) o usa la VM.

## Riesgo anti-ban

Cada envío usa el número del profesional (WhatsApp no oficial). Para no arriesgar
baneos: evita volúmenes altos de golpe, mensajes con valor (no spam), y un solo
recordatorio por cita (ya garantizado por `reminder_sent_at`).
