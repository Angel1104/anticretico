import { Nav, TestnetBanner } from "@/components";
import { DashboardContent } from "@/components/Dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <TestnetBanner />
      <Nav />
      <DashboardContent />
    </>
  );
}
