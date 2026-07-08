import { useState } from "react";
import { Link } from "react-router-dom";
import { useDefaultSchema, useSpecs } from "../hooks/useOpenSpec";
import { SchemaPill } from "../components/SchemaBadge";

export function SpecList() {
  const { data, loading, error } = useSpecs();
  const defaultSchema = useDefaultSchema();
  const [filter, setFilter] = useState("");

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  const specs = data ?? [];
  const filtered = filter
    ? specs.filter((s) => s.topic.toLowerCase().includes(filter.toLowerCase()))
    : specs;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Specs</h1>
        <div className="flex items-center gap-2 mt-1 text-text-muted text-sm">
          {defaultSchema && (
            <span className="flex items-center gap-2">
              Default schema:
              <SchemaPill schema={defaultSchema} title="Repo default OpenSpec schema" />
            </span>
          )}
          <span className="ml-auto">{specs.length} topics</span>
        </div>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter specs..."
        className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
      />

      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-text-muted text-sm">No specs found</p>
        ) : (
          filtered.map((spec) => (
            <Link
              key={spec.topic}
              to={`/specs/${spec.topic}`}
              className="block px-4 py-3 bg-bg-secondary border border-border rounded hover:border-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-text-primary font-medium">{spec.topic}</span>
                {spec.historyCount > 0 && (
                  <span className="text-text-muted text-xs">
                    {spec.historyCount} {spec.historyCount === 1 ? "change" : "changes"}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
