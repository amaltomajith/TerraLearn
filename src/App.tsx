import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "./components/home";
import { ThemeProvider } from "./components/ThemeProvider";

function App() {
  return (
    <ThemeProvider>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-foreground font-medium">Loading TerraLearn...</span>
          </div>
        </div>
      }>
        <>
          <Toaster position="top-right" richColors theme="system" />
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </>
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
