import { useState } from "react";
import { useSpecs } from "../hooks/useOpenSpec";
import { SpecTree } from "../components/SpecTree";

export function SpecList() {
  const { data, loading, error } = useSpecs();
  const [filter, setFilter] = useState("");

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-status-error">Error: {error}</p>;

  const specs = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Specs</h1>
        <span className="text-text-muted text-sm">{specs.length} topics</span>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter specs..."
        className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
      />

      <SpecTree specs={specs} filter={filter} />
    </div>
  );
}
