import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { guideFirst } from "@/server/onboarding/guide";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSessionOrNull();
  if (session && (await guideFirst(session))) redirect("/onboarding");
  redirect(session ? "/work" : "/inbox");
}
