import type { SourceRow } from "@/lib/analytics/sources";
import { formatAverage, formatCount } from "./format";

const KIND_NOTE = { utm: "utm_source", referrer: "referrer", direct: "" } as const;

export default function SourcesTable({ sources }: { sources: SourceRow[] }) {
  return (
    <section className="stats-card stats-table-card">
      <h2>Visits by source</h2>
      {sources.length === 0 ? (
        <p className="stats-subtle">No visits recorded in this range yet.</p>
      ) : (
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Visitors</th>
                <th scope="col">Visits</th>
                <th scope="col">Played / visitor</th>
                <th scope="col">Solved / visitor</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={`${s.kind}:${s.source}`}>
                  <td>
                    {s.source} <span className="stats-muted">{KIND_NOTE[s.kind]}</span>
                  </td>
                  <td>{formatCount(s.visitors)}</td>
                  <td>{formatCount(s.visits)}</td>
                  <td className={s.rounds ? "" : "zero"}>{formatAverage(s.roundsPerVisitor)}</td>
                  <td className={s.solved ? "" : "zero"}>{formatAverage(s.solvedPerVisitor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
