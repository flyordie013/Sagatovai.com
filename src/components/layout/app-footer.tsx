export function AppFooter() {
  return (
    <footer className="border-t border-line px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-between gap-2 text-center text-xs text-faint sm:flex-row sm:text-left">
        <p>© {new Date().getFullYear()} OQU</p>
        <p className="font-mono">Обучение с AI-наставником</p>
      </div>
    </footer>
  );
}
