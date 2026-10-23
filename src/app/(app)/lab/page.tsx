import { canConfigure } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { LabClient } from "@/components/lab/lab-client";

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const session = await getSessionOrNull();
  if (!session || !canConfigure(session.role)) redirect("/work");
  return <LabClient />;
}
