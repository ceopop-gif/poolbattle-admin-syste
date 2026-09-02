import { StaffResultEntry } from "@/components/staff-result-entry";

export const dynamic = "force-dynamic";

export default async function StaffResultPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const { player = "" } = await searchParams;
  return <StaffResultEntry playerId={player} />;
}
