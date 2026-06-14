# AgendaPro — SaaS de citas y expedientes para profesionales

SaaS multi-vertical (médicos, abogados, psicólogos, odontólogos, estética y genérico) para gestionar **citas, clientes/pacientes y expedientes**, con página pública de reservas online. Mercado principal: **Ecuador** (USD, zona horaria `America/Guayaquil`).

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Supabase**: Postgres con RLS multi-tenant, Auth, Storage, Edge Functions, pg_cron
- Proyecto Supabase: `qsshsxlybsoopufzbovf` (us-east-2)

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Variables en `.env.local` (ver `.env.example`).

## Estructura

| Ruta | Descripción |
|---|---|
| `/` | Landing |
| `/precios` | Planes (Gratis $0, Pro $19, Premium $39) |
| `/registro`, `/login` | Auth con email/contraseña |
| `/onboarding` | Wizard: vertical + nombre → crea organización, servicios y horario de ejemplo |
| `/app` | Agenda diaria: crear/reagendar/cambiar estado de citas |
| `/app/clientes`, `/app/clientes/[id]` | Directorio + expediente con plantillas por vertical |
| `/app/servicios` | CRUD de servicios |
| `/app/disponibilidad` | Franjas horarias semanales por profesional |
| `/app/facturacion` | Plan actual + pago por transferencia con comprobante |
| `/app/configuracion` | Datos de la organización + enlace público |
| `/reservar/[slug]` | **Página pública de reservas** (servicio → profesional → fecha → slot → datos) |
| `/admin` | Superadmin: organizaciones + aprobación de pagos |

## Arquitectura clave

- **Multi-tenant por RLS**: toda tabla lleva `organization_id`; helpers `is_org_member()`, `is_org_owner()`, `is_superadmin()` (SECURITY DEFINER) evalúan acceso.
- **Reservas públicas**: 3 RPCs SECURITY DEFINER expuestas a `anon`: `get_public_booking_info`, `get_available_slots`, `create_public_appointment` (con lock anti-doble-reserva).
- **Recordatorios**: trigger SQL programa recordatorio 24 h antes; Edge Function `send-reminders` (cron cada 15 min vía pg_cron + pg_net) envía con Resend.
- **Pagos**: transferencia bancaria + comprobante a Storage (`receipts`) + aprobación en `/admin`. Interfaz `PaymentGateway` en `src/lib/payments/gateway.ts` lista para PayPhone/Kushki/De Una (MercadoPago **no** opera en Ecuador).
- **Plantillas de expediente**: `record_templates` globales por vertical (semilla) con campos dinámicos JSONB; las organizaciones pueden crear propias.

## Pendientes de configuración (externos)

1. **SMTP propio (crítico para registro)**: el SMTP integrado de Supabase permite ~2 correos/hora — el registro falla con tráfico real. Configurar Resend/SMTP en *Supabase Dashboard → Auth → SMTP* y personalizar plantillas en español.
2. **`RESEND_API_KEY`** como secreto de la Edge Function `send-reminders` (Dashboard → Edge Functions → Secrets). Sin ella, los recordatorios quedan en cola.
3. **Google OAuth** (opcional): credenciales en Google Cloud Console + habilitar proveedor en Supabase.
4. **Datos bancarios reales**: editar `BANK_TRANSFER_INSTRUCTIONS` en `src/lib/payments/gateway.ts` (ahora placeholders).
5. **Protección de contraseñas filtradas**: activar en Dashboard → Auth (advisor pendiente).
6. Crear superadmin: `update profiles set is_superadmin = true where id = '<uuid>';`

## Fase 2 (IA)

1. ✅ **Transcripción voz → expediente** — dos modos (solo plan Premium, gate `ai_features`):
   - *Dictado*: botón "Dictar con IA" dentro de *Nueva entrada* — nota corta post-consulta que llena los campos.
   - *Consulta completa*: botón "Grabar consulta" en el expediente — graba toda la conversación profesional↔paciente (pausa/reanudar, cronómetro, ~1.5 h máx a 32 kbps), transcribe, llena campos y genera resumen con citas textuales del paciente + transcripción completa en notas. Abre *Nueva entrada* prellenada para revisar y guardar.
   - Requiere `GROQ_API_KEY` en `.env.local` (gratis en https://console.groq.com/keys).
   - Opcional `ANTHROPIC_API_KEY`: si existe, estructura con Claude (mejor calidad); si no, usa Groq (gratis).
   - Código: `src/lib/ai.ts`, `src/app/api/ai/transcribe/route.ts`, `src/lib/features.ts`.
2. WhatsApp con IA (WhatsApp Business Cloud API: confirmar/reagendar/recordar) — requiere verificación de negocio en Meta (business.facebook.com → Centro de seguridad; app en developers.facebook.com)
3. ✅ **Generación de documentos** — botón "Generar documento" en el expediente (Premium). Tipos por vertical (receta, certificado, consentimiento, contrato, informe… ver `src/lib/document-types.ts`); la IA redacta con datos del cliente + últimas 3 entradas + indicaciones; borrador editable → Imprimir/PDF (ventana de impresión con membrete y firma) o guardar como entrada del expediente. Código: `src/lib/actions/documents.ts`, `generateDocumentText` en `src/lib/ai.ts`.
4. ✅ **Predicción de abandono** — página "Riesgo de abandono" en el menú (Premium; free ve upsell). Score heurístico 0-100 explicable (sin LLM): inasistencias, cancelaciones, días sin volver vs. frecuencia habitual del cliente, cita futura resta riesgo. Niveles alto/medio con motivos y acción sugerida + enlaces WhatsApp/email. Datos vía RPC `client_risk_stats` (SECURITY INVOKER, RLS aplica); scoring en `src/lib/churn.ts`, página en `src/app/app/riesgo/`.
5. ✅ **Generador de contenido para redes** — página "Marketing" en el menú (Premium). Elige red (Instagram/Facebook/TikTok/estado de WhatsApp) + objetivo (atraer/promoción/educativo/recordatorio) + tema opcional → 3 publicaciones con caption, hashtags e idea de imagen, basadas en los servicios reales de la organización. Botón copiar. Código: `src/lib/actions/marketing.ts`, `src/app/app/marketing/`.

> Nota tests: `full_flow.py` aprueba un pago del plan Pro, lo que **pisa la suscripción Premium** de la org E2E. Tras correrlo, restaurar Premium por SQL para que los tests de IA pasen.

## Tests e2e

```bash
python e2e/full_flow.py   # requiere dev server corriendo y usuario e2e (ver e2e/)
```

Flujo cubierto: login → onboarding → cliente → entrada de expediente → reserva pública anónima → cita en agenda → pago con comprobante → aprobación superadmin → plan activo. Aislamiento multi-tenant verificado por SQL con JWT simulado.
