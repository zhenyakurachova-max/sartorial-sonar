import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { BottomNav } from "@/components/BottomNav";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Signup from "./pages/Signup.tsx";
import Interview from "./pages/Interview.tsx";
import InterviewComplete from "./pages/InterviewComplete.tsx";
import WardrobeStub from "./pages/WardrobeStub.tsx";
import WardrobeKeepTab from "./pages/WardrobeKeepTab.tsx";
import LooksStub from "./pages/LooksStub.tsx";
import RecommendationsStub from "./pages/RecommendationsStub.tsx";
import ProfileStub from "./pages/ProfileStub.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";

const queryClient = new QueryClient();
const Authed = ({ children }: { children: ReactNode }) => (
  <RequireAuth>
    {children}
    <BottomNav />
  </RequireAuth>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/app/interview" element={<Authed><Interview /></Authed>} />
            <Route path="/app/interview/complete" element={<Authed><InterviewComplete /></Authed>} />
            <Route path="/app/audit" element={<Authed><WardrobeStub /></Authed>} />
            <Route path="/app/wardrobe" element={<Authed><WardrobeKeepTab /></Authed>} />
            <Route path="/app/looks" element={<Authed><LooksStub /></Authed>} />
            <Route path="/app/buy" element={<Authed><RecommendationsStub /></Authed>} />
            <Route path="/app/profile" element={<Authed><ProfileStub /></Authed>} />
            {/* Legacy redirects */}
            <Route path="/app/gaps" element={<Navigate to="/app/wardrobe" replace />} />
            <Route path="/app/recommendations" element={<Navigate to="/app/buy" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
