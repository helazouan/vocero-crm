import { TemplatesClient } from "@/components/settings/templates-client";
import { requireSession } from "@/lib/auth/session";
import { getCredentialsByOrg } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

export default async function TemplatesSettingsPage() {
  const session = await requireSession();
  const credentials = await getCredentialsByOrg(session.organizationId);
  return <TemplatesClient whatsappConnected={credentials?.status === "connected"} />;
}
