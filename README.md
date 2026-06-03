# La Scalonetta ⚽🇦🇷 — Prode Mundial 2026

App de prode para jugar con amigos, conectada a una base de datos real (Supabase) y publicada en Vercel.

---

## Qué necesitás (todo gratis)

- Una cuenta de **GitHub** (para subir el código).
- Una cuenta de **Supabase** (la base de datos).
- Una cuenta de **Vercel** (donde vive la web).

Ninguna de estas cuentas la puedo crear yo por vos: tenés que registrarte vos.

---

## PASO 1 — Crear la base de datos en Supabase

1. Entrá a https://supabase.com y creá una cuenta (podés entrar con GitHub).
2. Tocá **New project**. Ponele nombre (ej. `scalonetta`), elegí una contraseña para la base (guardala, aunque no la vas a usar en la app) y una región (la más cercana, ej. *South America (São Paulo)*).
3. Esperá ~2 minutos a que el proyecto se cree.
4. En el menú izquierdo, andá a **SQL Editor** → **New query**.
5. Abrí el archivo `supabase.sql` de este proyecto, copiá TODO su contenido, pegalo y tocá **Run**. Debería decir "Success".
6. Ahora andá a **Project Settings** (el engranaje) → **API**. Anotá dos cosas:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** key (una clave larga que empieza con `eyJ...`)

> Esa `anon key` es pública por diseño, no es un secreto grave. Igual no la pegues en lugares públicos.

---

## PASO 2 — Subir el código a GitHub

1. Creá un repo nuevo en https://github.com/new (privado o público, da igual).
2. Subí todos los archivos de este proyecto al repo. Si no usás git por consola, podés usar el botón **"uploading an existing file"** de GitHub y arrastrar la carpeta (sin `node_modules` ni `.env.local`).

---

## PASO 3 — Publicar en Vercel

1. Entrá a https://vercel.com y registrate con tu cuenta de GitHub.
2. Tocá **Add New → Project** y elegí el repo que subiste.
3. Vercel detecta que es un proyecto Vite solo. **Antes de tocar Deploy**, abrí **Environment Variables** y agregá estas dos (las del Paso 1):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | tu Project URL |
   | `VITE_SUPABASE_ANON_KEY` | tu anon public key |

4. Tocá **Deploy**. En ~1 minuto te da una URL tipo `https://scalonetta.vercel.app`.

¡Esa URL es la que compartís con tus amigos! No necesitan cuenta de nada, entran y juegan.

---

## PASO 4 — Arrancar

1. Entrá vos primero a la URL y **registrate** → quedás como **admin** 👑.
2. Probá: cargá un pick, **recargá la página**. Tiene que seguir ahí (ahora sí persiste de verdad).
3. Desde otro dispositivo / que un amigo entre y se registre. En la **Tabla** tienen que aparecer los dos.
4. Cuando todo esté ok, en **Admin → Zona peligrosa → Resetear todo** limpiás los datos de prueba antes del Mundial.
5. Pasá la URL al grupo. 🎉

---

## Las reglas (ya programadas)

- **Fase de grupos:** gana / empata / pierde → **2 puntos** por acierto. Cierra el 10/6 23:59 (ARG).
- **Eliminación:** elegís quién pasa → **3 puntos**. Cada fase la abrís vos (admin) cuando se conocen los cruces.
- **Campeón:** lo elegís antes de que arranque → **10 puntos**. Visible para todos. El resto de los picks se destapan al cerrar cada fase.
- Horarios de todos los partidos en hora Argentina.

---

## Para probar en tu compu antes (opcional)

```bash
npm install
cp .env.example .env.local   # y completá con tus claves
npm run dev
```

---

## Nota de seguridad honesta

El login es **nombre + contraseña simple**: es una barrera entre amigos, NO seguridad real. Las contraseñas quedan en la base accesibles. **Que nadie use una contraseña que use en otro lado.**

Si despublicás o borrás el proyecto de Supabase, se pierden los datos. Usá el botón **Exportar CSV** del panel admin cada tanto como backup.
