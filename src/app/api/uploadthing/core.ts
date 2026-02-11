import { createUploadthing, type FileRouter } from "uploadthing/next";
import { createClient } from "@libsql/client";

const f = createUploadthing();

// Conexión directa a Turso (la instancia de db.js no es accesible desde API routes)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function authPremium(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new Error("No autenticado");

  const result = await db.execute({
    sql: "SELECT id, es_premium FROM usuarios WHERE id = ?",
    args: [Number(userId)],
  });
  const user = result.rows[0];
  if (!user) throw new Error("Usuario no encontrado");
  if (!user.es_premium) throw new Error("Requiere premium");

  return { userId: Number(user.id) };
}

export const ourFileRouter = {
  audioUploader: f({ audio: { maxFileSize: "512KB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const { userId } = await authPremium(req);
      const tipoAudio = req.headers.get("x-tipo-audio");
      if (!tipoAudio) throw new Error("Tipo de audio requerido");
      return { userId, tipoAudio };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db.execute({
        sql: `INSERT OR REPLACE INTO audios_custom (usuario_id, tipo_audio, url_archivo, file_key)
              VALUES (?, ?, ?, ?)`,
        args: [metadata.userId, metadata.tipoAudio, file.ufsUrl, file.key],
      });
      return { url: file.ufsUrl };
    }),

  avatarUploader: f({ image: { maxFileSize: "1MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const { userId } = await authPremium(req);
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db.execute({
        sql: "UPDATE usuarios SET avatar_url = ? WHERE id = ?",
        args: [file.ufsUrl, metadata.userId],
      });
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
