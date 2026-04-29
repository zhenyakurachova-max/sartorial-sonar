import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Signup from "./pages/Signup.tsx";
import Interview from "./pages/Interview.tsx";
import InterviewComplete from "./pages/InterviewComplete.tsx";
import WardrobeStub from "./pages/WardrobeStub.tsx";
import GapsStub from "./pages/GapsStub.tsx";

const queryClient = new QueryClient();

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
              element={<RequireAuth><Interview /></RequireAuth>}
            />
            <Route
              path="/app/interview/complete"
              element={<RequireAuth><InterviewComplete /></RequireAuth>}
            />
            <Route
              path="/app/wardrobe"
              element={<RequireAuth><WardrobeStub /></RequireAuth>}
            />
            <Route
              path="/app/gaps"
              element={<RequireAuth><GapsStub /></RequireAuth>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
