import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/components/auth/LoginPage";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { AdminRoute } from "@/components/auth/AdminRoute";
const Index = lazy(() => import("./pages/Index"));
import { LandingPage } from "@/components/landing/LandingPage";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
import NotFound from "./pages/NotFound";

const AccountPage = lazy(() => import('./pages/AccountPage'));
const AccountActionPage = lazy(() => import('./pages/AccountActionPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

const queryClient = new QueryClient();

/** Ensures the saved theme class is applied on every route (including /login, /register). */
function ThemeSync() {
  useEffect(() => {
    const stored = localStorage.getItem('fatigue-theme') as 'dark' | 'light' | null;
    const theme = stored || 'dark';
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }, []);
  return null;
}

function SessionBoundary({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground" role="status">Loading your session…</div>;
  return <AnalysisProvider key={user?.id ?? 'guest'}>{children}</AnalysisProvider>;
}

function Welcome() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  if (isAuthenticated) return <Navigate to="/roster" replace />;
  return <LandingPage onEnter={() => navigate('/roster')} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SessionBoundary>
        <TooltipProvider>
          <ThemeSync />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<p role="status" className="p-8">Loading…</p>}><Routes>
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account-action" element={<AccountActionPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/" element={<Welcome />} />
              {["/roster", "/report", "/history", "/learn"].map(path => <Route key={path} path={path} element={<Index />} />)}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/admin" element={<AdminRoute><Suspense fallback={<p role="status">Loading administration…</p>}><AdminDashboard /></Suspense></AdminRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes></Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </SessionBoundary>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
