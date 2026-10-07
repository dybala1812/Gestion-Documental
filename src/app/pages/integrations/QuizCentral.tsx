import { useMemo, useState } from "react";
import { ExternalLink, BookOpen as GraduationCap, Presentation, LogIn } from "lucide-react";

const QUIZ_ROOT = "/quiz-app";

type QuizView = "student" | "teacher";

export function QuizCentral() {
  const [activeView, setActiveView] = useState<QuizView>("student");

  const currentPath = useMemo(() => {
    if (activeView === "teacher") return `${QUIZ_ROOT}/teacher/`;
    return `${QUIZ_ROOT}/student/`;
  }, [activeView]);

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">ElectroQuiz Integrado</h1>
          <p className="text-sm text-slate-600">
            Vistas embebidas para estudiantes y docentes en el mismo dominio NOVA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${QUIZ_ROOT}/login/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Login Quiz
            <LogIn className="h-4 w-4" />
          </a>
          <a
            href={currentPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Abrir vista actual
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveView("student")}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            activeView === "student"
              ? "bg-[#1e3a5f] text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Vista Estudiantes
        </button>
        <button
          type="button"
          onClick={() => setActiveView("teacher")}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            activeView === "teacher"
              ? "bg-[#1e3a5f] text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Presentation className="h-4 w-4" />
          Vista Docentes
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <iframe
          src={currentPath}
          title={`ElectroQuiz ${activeView === "teacher" ? "Docentes" : "Estudiantes"}`}
          className="h-[calc(100vh-220px)] min-h-[700px] w-full"
        />
      </div>
    </section>
  );
}