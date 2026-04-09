export function Footer() {
  return (
    <footer className="hidden border-t border-border/50 bg-surface-800/50 py-4 md:block">
      <div className="mx-auto max-w-7xl px-6 text-center text-xs text-text-disabled">
        Game data provided by{" "}
        <a
          href="https://www.igdb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-secondary underline-offset-2 transition-colors hover:text-primary-400 hover:underline"
        >
          IGDB
        </a>{" "}
        /{" "}
        <a
          href="https://www.twitch.tv"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-secondary underline-offset-2 transition-colors hover:text-primary-400 hover:underline"
        >
          Twitch
        </a>
      </div>
    </footer>
  );
}
