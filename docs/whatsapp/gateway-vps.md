# Gateway WhatsApp (OpenWA + Baileys) en el VPS

agenda-pro NO habla con WhatsApp directo. Habla con un **gateway OpenWA** que vive
en el VPS y mantiene **una sesión por organización** (cada profesional escanea su
propio QR). El motor **Baileys** (WebSocket, sin navegador) es obligatorio: en 2 GB
de RAM aguanta ~20 sesiones; con el motor por defecto (whatsapp-web.js / Chromium)
solo 1-2.

## 0. Requisitos del VPS

- 2 GB RAM, 2 vCPU, Linux, root + SSH (✅ tu plan free).
- Docker + Docker Compose.

## 1. Instalar Docker (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sh
docker --version
```

## 2. Clonar y configurar OpenWA

```bash
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
```

Crea un `.env` (motor Baileys + SQLite para no gastar RAM):

```bash
cat > .env <<'EOF'
ENGINE_TYPE=baileys
API_KEY=PON_UNA_CLAVE_LARGA_Y_SECRETA
PORT=2785
EOF
```

> La variable exacta del motor puede variar entre versiones. Verifica en el
> README/Swagger del repo. Si no es `ENGINE_TYPE`, busca `ENGINE`/`WA_ENGINE`.

## 3. Levantar (SQLite, sin Postgres = menos RAM)

```bash
docker compose up -d
docker compose logs -f   # ver que arranca
```

Queda en `http://IP_DEL_VPS:2785`. Swagger (lista REAL de endpoints):
`http://IP_DEL_VPS:2785/api/docs` ← **úsalo para confirmar las rutas**.

## 4. Firewall — exponer solo lo necesario

```bash
ufw allow 22/tcp
ufw allow 2785/tcp
ufw enable
```

## 5. Conectar agenda-pro al gateway

En `.env.local` (y en producción):

```
OPENWA_URL=http://IP_DEL_VPS:2785
OPENWA_API_KEY=la_misma_clave_del_.env
```

## 6. Probar manual (antes de la UI)

```bash
# crear sesión
curl -X POST http://IP_DEL_VPS:2785/api/sessions \
  -H "X-API-Key: TU_CLAVE" -H "Content-Type: application/json" \
  -d '{"name":"prueba"}'

# obtener QR
curl http://IP_DEL_VPS:2785/api/sessions/prueba/qr -H "X-API-Key: TU_CLAVE"
```

Escanea el QR con WhatsApp → Dispositivos vinculados. Luego:

```bash
curl -X POST http://IP_DEL_VPS:2785/api/sessions/prueba/messages/send-text \
  -H "X-API-Key: TU_CLAVE" -H "Content-Type: application/json" \
  -d '{"chatId":"593XXXXXXXXX@c.us","text":"hola desde el gateway"}'
```

## Pendiente para producción (no MVP)

- **HTTPS**: poner Caddy/Nginx delante con dominio + TLS (no exponer 2785 plano).
- **Webhook entrante** (Fase 3): apuntar a `https://TU_APP/api/webhooks/whatsapp`.
- **Backups** de la carpeta de sesiones de OpenWA (volumen Docker).

## Riesgo a tener claro

WhatsApp no oficial → el número de cada pro puede ser **baneado** si manda spam o
volumen alto. Mitiga: límites de envío, número secundario, mensajes con opt-out.
