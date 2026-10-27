import { SearchForm } from "./search-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Reality Scanner CZ</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Find Prague flats by walking distance to the metro. Searches Czech real estate sites at once. Try “2+kk near Malostranská, max 5 minutes”.
        </p>
      </header>
      <SearchForm />
    </main>
  );
}
