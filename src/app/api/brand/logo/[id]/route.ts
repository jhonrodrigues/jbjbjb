
import { getPool } from "@/db/client";
import { getSessionUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LogoRecord = {
  image_bytes: Buffer;
  mime_type: string;
  lp_status: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[1-9]\d{0,17}$/.test(id)) {
    return new Response("ID invalido", { status: 400 });
  }

  try {
    const resultado = await getPool().query<LogoRecord>(
      `
      SELECT
        f.image_bytes,
        f.mime_type,
        lp.status::text AS lp_status
      FROM jb_agent_brand_files f

      JOIN jb_agent_brand_assets b
        ON b.lead_id = f.lead_id

      LEFT JOIN jb_agent_lps lp
        ON lp.lead_id = f.lead_id

      WHERE f.lead_id = $1::bigint
        AND b.logo_status = 'created_demo'
        AND f.is_conceptual = TRUE
        AND f.mime_type IN (
          'image/png',
          'image/jpeg',
          'image/webp'
        )

      LIMIT 1
      `,
      [id]
    );

    const logo = resultado.rows[0];

    if (!logo?.image_bytes?.length) {
      return new Response("Logo nao encontrado", {
        status: 404,
      });
    }

    const publicado = logo.lp_status === "published";

    // Em rascunhos, somente usuarios autenticados
    if (!publicado) {
      const usuario = await getSessionUser();

      if (!usuario) {
        return new Response("Logo nao disponivel", {
          status: 404,
        });
      }
    }

    return new Response(
      Uint8Array.from(logo.image_bytes),
      {
        status: 200,
        headers: {
          "Content-Type": logo.mime_type,
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex",
          "Cache-Control": publicado
            ? "public, max-age=300"
            : "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao carregar logotipo:", error);

    return new Response(
      "Erro ao carregar imagem",
      { status: 500 }
    );
  }
}
