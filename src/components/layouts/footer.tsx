export function Footer() {
  return (
    <footer className="border-border/50 bg-surface-800/50 hidden border-t py-4 md:block">
      <div className="text-text-disabled mx-auto max-w-7xl px-6 text-center text-xs">
        Game data provided by{" "}
        <a
          href="https://www.igdb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-secondary hover:text-primary-400 underline-offset-2 transition-colors hover:underline"
        >
          IGDB
        </a>{" "}
        /{" "}
        <a
          href="https://www.twitch.tv"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-secondary hover:text-primary-400 underline-offset-2 transition-colors hover:underline"
        >
          Twitch
        </a>
      </div>
    </footer>
  );
}
