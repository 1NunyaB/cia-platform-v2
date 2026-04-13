import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

export default function DashboardLoading() {
  return (
    <div className="space-y-4 py-6">
      <InvestigationLoadingIndicator label="Scanning evidence workspace..." />
    </div>
  );
}
