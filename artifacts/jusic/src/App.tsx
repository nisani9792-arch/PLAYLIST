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
        <Toaster
          theme="dark"
          dir="rtl"
          toastOptions={{
            classNames: {
              toast:
                "rounded-xl border border-white/15 bg-neutral-950/95 backdrop-blur-xl shadow-xl font-sans",
              title: "font-semibold",
              description: "text-muted-foreground",
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
