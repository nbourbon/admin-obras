# Deployment a Fly.io

Guía paso a paso para migrar el backend de Render a Fly.io.

## 1. Crear cuenta en Fly.io

1. Ir a https://fly.io y crear una cuenta gratuita
2. Verificar email

## 2. Instalar Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows (WSL)
curl -L https://fly.io/install.sh | sh
```

## 3. Autenticarse

```bash
flyctl auth login
```

Esto abre el browser para que inicies sesión.

## 4. Crear el token para GitHub Actions (opcional, para deploy automático)

```bash
flyctl auth token
```

Copia el token que aparece. Lo vas a usar en GitHub.

## 5. Deployar la app

```bash
cd construccion-edificio

# Opción A: Deploy interactivo (primera vez recomendado)
flyctl launch

# O si ya tienes los archivos configurados:
flyctl deploy
```

Durante `flyctl launch` te preguntará:
- **App name**: `admin-obras-api` (o el que prefieras)
- **Region**: selecciona `gru` (São Paulo)
- **Postgres database**: responde `No` (usamos Supabase)

## 6. Configurar variables de entorno

```bash
flyctl secrets set \
  DATABASE_URL="postgresql://user:password@...supabase.co:5432/postgres" \
  SECRET_KEY="tu-secret-key-super-seguro" \
  CLOUDINARY_CLOUD_NAME="tu-cloudinary-name" \
  CLOUDINARY_API_KEY="tu-api-key" \
  CLOUDINARY_API_SECRET="tu-api-secret" \
  GOOGLE_CLIENT_ID="204864874637-13m642q5imvo24phvl2ctc56t6s2u38k.apps.googleusercontent.com"
```

Para obtener la `DATABASE_URL` de Supabase:
1. Supabase → Settings → Database → Connection string
2. Elige "URI" y copia la URL

## 7. Configurar GitHub Actions (deploy automático)

1. GitHub → Repository Settings → Secrets and variables → Actions
2. Click en "New repository secret"
3. Name: `FLY_API_TOKEN`
4. Value: pega el token de `flyctl auth token`
5. Add secret

Ahora cada push a `main` va a deployar automáticamente.

## 8. Actualizar el frontend en Vercel

1. Vercel → Project settings → Environment variables
2. Busca `VITE_API_URL`
3. Cambia el valor de la URL de Render a: `https://proyectos-compartidos.fly.dev`
4. (O el nombre que elegiste si no usaste `admin-obras-api`)
5. Redeploy en Vercel

## 9. Probar la app

- Login con email/password ✓
- Login con Google ✓
- Crear gasto ✓
- Subir archivo ✓
- Dashboard ✓

## 10. Apagar Render (cuando todo funcione)

Render → Settings → Delete Application

---

## Comandos útiles

```bash
# Ver logs
flyctl logs

# Ver estado de la app
flyctl status

# Ejecutar comando en la VM (debugging)
flyctl ssh console

# Escalar (cambiar RAM/CPU)
flyctl scale vm memory 1024

# Destruir y empezar de nuevo
flyctl destroy
```

## Costos

- **Free tier**: $5/mes de crédito
- **Esta app**: ~$2/mes (VM 512MB) → **gratis dentro del free tier**

No hay cargos sorpresas. Verifica el uso en `flyctl billing summary`.

## Troubleshooting

**"Connection refused" al conectar a Supabase**
- Verifica que `DATABASE_URL` esté correcta
- Comprueba que IP de Fly está autorizada en Supabase (generalmente está configurado por defecto)

**La app se demora mucho en iniciar**
- Primera vez es normal (image building, etc.)
- Después debería ser rápido

**Necesito revertir un deploy**
- Los deploys anteriores se guardan: `flyctl releases`
- Para volver a uno anterior: `flyctl releases rollback`

---

¿Preguntas? Revisa https://fly.io/docs/
