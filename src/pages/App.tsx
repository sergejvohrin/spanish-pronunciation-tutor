import { useState } from "react";

import { Button } from "@/components/ui/button";
import { IndexPage } from "@/pages/Index";
import { PronunciationTutorPage } from "@/pages/PronunciationTutor";

type AppView = "publisher" | "tutor";

export function App() {
  const [view, setView] = useState<AppView>("tutor");

  return (
    <div className="min-h-screen">
      <div className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 p-3 md:px-8">
          <div className="text-sm font-semibold text-slate-900">Sergejs playground</div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={view === "tutor" ? "default" : "secondary"}
              onClick={() => setView("tutor")}
            >
              Tutor
            </Button>
            <Button
              type="button"
              variant={view === "publisher" ? "default" : "secondary"}
              onClick={() => setView("publisher")}
            >
              Publisher
            </Button>
          </div>
        </div>
      </div>

      {view === "tutor" ? <PronunciationTutorPage /> : <IndexPage />}
    </div>
  );
}

