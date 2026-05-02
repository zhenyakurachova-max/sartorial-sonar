import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import GapsStub from "./pages/GapsStub.tsx";
import RecommendationsStub from "./pages/RecommendationsStub.tsx";
import ProfileStub from "./pages/ProfileStub.tsx";

const queryClient = new QueryClient();
const Authed = ({ children }: { children: React.ReactNode }) => (
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
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/app/interview"
              element={<Authed><Interview /></Authed>}
            />
            <Route
              path="/app/interview/complete"
              element={<Authed><InterviewComplete /></Authed>}
            />
            <Route
              path="/app/wardrobe"
              element={<Authed><WardrobeStub /></Authed>}
            />
            <Route
              path="/app/gaps"
              element={<Authed><GapsStub /></Authed>}
            />
            <Route
              path="/app/recommendations"
              element={<Authed><RecommendationsStub /></Authed>}
            />
            <Route
              path="/app/profile"
              element={<Authed><ProfileStub /></Authed>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
