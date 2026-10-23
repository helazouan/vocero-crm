import { canConfigure } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { AgentClient } from "@/components/agent/agent-client";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const session = await getSessionOrNull();
  if (!session || !canConfigure(session.role)) redirect("/work");
  return <AgentClient />;
}
