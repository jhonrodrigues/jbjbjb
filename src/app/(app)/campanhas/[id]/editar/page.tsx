import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCampaignById } from "@/lib/campaigns";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Editar campanha" };
export const dynamic = "force-dynamic";

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        eyebrow="Campanhas"
        title="Editar campanha"
        description={campaign.name}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/campanhas/${id}`}>
              <ArrowLeft /> Voltar
            </Link>
          </Button>
        }
      />
      <CampaignForm campaign={campaign} />
    </div>
  );
}
