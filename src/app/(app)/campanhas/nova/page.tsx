import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nova campanha" };
export const dynamic = "force-dynamic";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        eyebrow="Campanhas"
        title="Nova campanha"
        description="A campanha define o universo de empresas que os agentes vão prospectar."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/campanhas">
              <ArrowLeft /> Voltar
            </Link>
          </Button>
        }
      />
      <CampaignForm />
    </div>
  );
}
