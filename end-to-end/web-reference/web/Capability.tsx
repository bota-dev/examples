const repository = 'https://github.com/bota-dev/examples/blob/main/end-to-end/web-reference/';

export function Capability({
  calls,
  docs,
  source,
  label = 'Public API · server-side sample',
}: {
  calls: string[];
  docs: string;
  source: string;
  label?: string;
}) {
  return (
    <aside className="capability-sample" aria-label="Integration sample">
      <p className="eyebrow">{label}</p>
      <ul>
        {calls.map((call) => (
          <li key={call}>
            <code>{call}</code>
          </li>
        ))}
      </ul>
      <p>
        <a href={docs} target="_blank" rel="noopener noreferrer">
          API documentation <span aria-hidden="true">↗</span>
        </a>
        <a href={`${repository}${source}`} target="_blank" rel="noopener noreferrer">
          Sample source <span aria-hidden="true">↗</span>
        </a>
      </p>
    </aside>
  );
}
