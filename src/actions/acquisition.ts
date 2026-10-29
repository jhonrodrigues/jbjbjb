"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { saveAcquisitionSpend } from "@/lib/acquisition-metrics";
import { logError } from "@/lib/logger";

const schema = z.object({
  source:z.enum(["meta_ads","whatsapp_organic","form","b2b_email","organic","other"]),
  campaignKey:z.string().max(160).regex(/^[a-zA-Z0-9_.:-]*$/),
  spendDate:z.iso.date(),
  amountBrl:z.string().regex(/^(?:0|[1-9][0-9]{0,8})(?:[.,][0-9]{1,2})?$/),
});

export async function saveAcquisitionSpendAction(form:FormData):Promise<void> {
  const user=await requireAdmin();
  const parsed=schema.safeParse({
    source:form.get("source"),campaignKey:form.get("campaignKey") ?? "",
    spendDate:form.get("spendDate"),amountBrl:form.get("amountBrl"),
  });
  if(!parsed.success) redirect("/aquisicao?error=Confira+os+dados+de+investimento");
  try {
    await saveAcquisitionSpend({
      source:parsed.data.source,campaignKey:parsed.data.campaignKey,
      spendDate:parsed.data.spendDate,
      amountBrl:parsed.data.amountBrl.replace(",","."),userId:user.id,
    });
  } catch(error) {
    logError("Falha ao registrar gasto de aquisição",error);
    redirect("/aquisicao?error=N%C3%A3o+foi+poss%C3%ADvel+salvar");
  }
  revalidatePath("/aquisicao");
  redirect("/aquisicao?ok=Investimento+registrado");
}
