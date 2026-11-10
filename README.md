# PGPM MEX · Admin de cuentas, suscripciones y licencias

Aplicación privada para llevar el control de:

- **Clientes** a quienes vendes.
- **Cuentas** (Autodesk, Microsoft, Adobe…): usuario y contraseña cifrados, tipo administrador/usuario y de qué cuenta admin depende cada usuario.
- **Suscripciones** vendidas: cuenta, cliente, programas incluidos (solo AutoCAD, colección completa…), fecha de compra, costo, precio, fecha de renovación y estado.
- **Licencias** (claves de Windows, Office…): clave cifrada, disponible/utilizada, cliente y fecha de uso.
- **Panel** con renovaciones próximas, ganancia acumulada y existencias de licencias.
- **Aviso diario por correo** con las renovaciones a 30, 15, 7, 3, 1 y 0 días (y las vencidas).

Stack: Next.js 16 · Supabase (Postgres + Auth) · Resend · Vercel. Todo cabe en los planes gratuitos.

## Seguridad

| Protección | Cómo funciona |
| --- | --- |
| Cifrado en reposo | Correos de cuentas, contraseñas, claves de licencia, contactos y notas se cifran con **AES-256-GCM** antes de guardarse. La llave (`ENCRYPTION_KEY`) solo existe en el servidor. Si roban la base de datos, ven basura. |
| Secretos bajo demanda | Contraseñas y claves **no** se mandan al navegador en las listas. Se descifran una por una al pulsar *mostrar* o *copiar* y cada consulta queda en la bitácora (sección Seguridad). |
| RLS | Políticas de seguridad por fila en Postgres: cada usuario solo puede leer/escribir sus propias filas. |
| Registro cerrado | No hay página de registro. Creas tu usuario a mano en Supabase y, además, `ALLOWED_EMAILS` limita quién puede entrar. |
| Cabeceras | `X-Frame-Options`, `nosniff`, `Referrer-Policy` y `noindex`. |

> **Importante:** guarda `ENCRYPTION_KEY` en un gestor de contraseñas. Si la pierdes, los datos cifrados no se pueden recuperar.

## Puesta en marcha (≈ 20 minutos)

### 1. Supabase (base de datos y login)

1. Crea un proyecto gratuito en <https://supabase.com>.
2. Abre **SQL Editor → New query**, pega el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) y ejecútalo. Después ejecuta, en orden, los demás archivos de `supabase/migrations/` (`0002_subscription_email.sql`, `0003_account_term.sql`, `0004_subscription_promo.sql`…). Si ya tenías el proyecto creado, solo te falta ejecutar los nuevos.
3. **Authentication → Sign In / Providers → Email**: desactiva *Allow new users to sign up*. (Opcional: desactiva *Confirm email* para no depender del correo de confirmación.)
4. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña larga. Marca *Auto Confirm User*.
5. **Project Settings → API**: copia `Project URL`, la llave `anon`/`publishable` y la llave `service_role` (esta última es secreta).

### 2. Llave de cifrado

```bash
openssl rand -base64 32
```

Guarda el resultado: será `ENCRYPTION_KEY`.

### 3. Resend (avisos por correo)

1. Crea una cuenta gratuita en <https://resend.com> y genera una **API key**.
2. Sin dominio propio puedes enviar desde `onboarding@resend.dev` **solo a tu propio correo** (el de la cuenta de Resend). Con dominio verificado puedes usar `avisos@tudominio.com`.

### 4. Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores. Las mismas variables se configuran en Vercel.

```bash
cp .env.example .env.local
```

### 5. Probar en tu computadora

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:3000> e inicia sesión con el usuario que creaste en Supabase.

### 6. Publicar en Vercel (dominio gratuito)

1. Sube el proyecto a un repositorio de GitHub (privado).
2. En <https://vercel.com> → **Add New → Project** → importa el repositorio.
3. En **Environment Variables** pega todas las variables de `.env.local`. Agrega también `CRON_SECRET` con una cadena larga aleatoria.
4. Deploy. Tu app quedará en `https://<nombre>.vercel.app`.
5. El archivo [`vercel.json`](vercel.json) programa el cron diario (14:00 UTC = 08:00 CDMX) que llama a `/api/cron/renewals`. Vercel manda automáticamente `Authorization: Bearer <CRON_SECRET>`.
6. En Supabase → **Authentication → URL Configuration** pon tu URL de Vercel como *Site URL*.

Para probar el cron a mano:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://<nombre>.vercel.app/api/cron/renewals
```

> El plan gratuito de Supabase pausa proyectos tras 7 días sin actividad. El cron diario lo mantiene despierto; si se llegara a pausar, se reactiva con un clic en el panel de Supabase.

## Estructura

```
src/
  app/
    login/                 inicio de sesión
    (app)/                 zona privada: panel, clientes, cuentas, suscripciones, licencias, seguridad
    api/cron/renewals/     aviso diario por correo
  components/              UI (botones, diálogos, campo secreto…) y gestores por módulo
  lib/
    actions.ts             acciones de servidor: validan (zod), cifran y guardan
    data.ts                lecturas: consultan Supabase y descifran
    crypto.ts              AES-256-GCM
    auth.ts                requireUser(): sesión + lista de correos permitidos
    supabase/server.ts     clientes de Supabase (sesión y servicio)
  proxy.ts                 refresca la sesión y protege rutas
supabase/migrations/       esquema SQL con políticas RLS
```

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # compilar
npm run lint     # revisar código
```
