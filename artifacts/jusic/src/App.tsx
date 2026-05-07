import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchFiltersProvider } from "@/contexts/SearchFiltersContext";
import Workspace from "@/pages/Workspace";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SearchFiltersProvider>
          <Workspace />
        </SearchFiltersProvider>
        <Toaster theme="dark" dir="rtl" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
