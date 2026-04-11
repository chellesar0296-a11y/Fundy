import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ROUTE_PATHS } from "@/lib/index";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import CampaignManage from "@/pages/CampaignManage";
import About from "@/pages/About";
import Dashboard from "@/pages/Dashboard";
import CreateCampaign from "@/pages/CreateCampaign";
import Rewards from "@/pages/Rewards";
import AdminDashboard from "@/pages/AdminDashboard";
import VerificationRequest from "@/pages/VerificationRequest";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors closeButton expand={false} />
        <Router>
          <Layout>
            <Routes>
              <Route path={ROUTE_PATHS.HOME} element={<Home />} />
              <Route path={ROUTE_PATHS.CAMPAIGNS} element={<Campaigns />} />
              <Route path={ROUTE_PATHS.CAMPAIGN_DETAIL} element={<CampaignDetail />} />
              <Route path="/campaign/:id/manage" element={<CampaignManage />} />
              <Route path={ROUTE_PATHS.ABOUT} element={<About />} />
              <Route path={ROUTE_PATHS.DASHBOARD} element={<Dashboard />} />
              <Route path="/create-campaign" element={<CreateCampaign />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/verify" element={<VerificationRequest />} />
              {/* Login/Register now handled by AuthModal in Layout — keep fallback */}
              <Route path={ROUTE_PATHS.LOGIN} element={<Home />} />
              <Route path={ROUTE_PATHS.REGISTER} element={<Home />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Layout>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
