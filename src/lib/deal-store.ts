import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contactEvents } from "@/db/schema";
import { deriveDealState, type DealEvent } from "@/lib/deals";

const DEAL_TYPES = [
  "proposta_rascunho", "proposta_enviada", "aceite_recebido",
  "pagamento_confirmado", "entrega_item_concluido", "entrega_concluida",
];

export async function getDealState(contactId: string) {
  const events = await getDb().select().from(contactEvents)
    .where(eq(contactEvents.contactId, contactId))
    .orderBy(desc(contactEvents.createdAt), desc(contactEvents.id))
    .limit(500);
  return deriveDealState(events.filter(event => DEAL_TYPES.includes(event.type)) as DealEvent[]);
}
