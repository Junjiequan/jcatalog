import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { useAuth } from "@/store/auth";
import LoginPage from "@/features/auth/LoginPage";
import { Compass } from "lucide-react";
import { TipProvider } from "@/components/ui/Overlay";
import { EmptyState, Page } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { AppShell } from "@/components/layout/Shell";
import DatasetsPage from "@/features/datasets/DatasetsPage";
import DatasetDetailPage from "@/features/datasets/DatasetDetailPage";
import { ExperimentsPage, ProposalDetailPage, ProposalsPage } from "@/features/proposals/ProposalsPages";
import { InstrumentsPage, JobsPage, PublishedPage, SamplesPage } from "@/features/catalog/CatalogPages";
import SampleDetailPage from "@/features/catalog/SampleDetailPage";
import PublishedDetailPage from "@/features/catalog/PublishedDetailPage";
import SettingsPage from "@/features/settings/SettingsPage";

function NotFound() {
  return (
    <Page>
      <EmptyState icon={Compass} title="We couldn't find that page" description="The link may be old, or the page may have moved.">
        <Link to="/datasets"><Button variant="primary">Go to datasets</Button></Link>
      </EmptyState>
    </Page>
  );
}

// a visitor who is not signed in is sent to the login page, and back to where they were afterwards
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAuth((s) => s.session);
  const loc = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: `${loc.pathname}${loc.search}` }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <TipProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Navigate to="/datasets" replace />} />
          <Route path="datasets" element={<DatasetsPage />} />
          <Route path="datasets/:pid" element={<DatasetDetailPage />} />
          <Route path="proposals" element={<ProposalsPage />} />
          <Route path="proposals/:id" element={<ProposalDetailPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
          <Route path="experiments/:id" element={<ProposalDetailPage />} />
          <Route path="samples" element={<SamplesPage />} />
          <Route path="samples/:id" element={<SampleDetailPage />} />
          <Route path="instruments" element={<InstrumentsPage />} />
          <Route path="published" element={<PublishedPage />} />
          <Route path="published/:id" element={<PublishedDetailPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </TipProvider>
  );
}
