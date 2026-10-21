import { HELPLINES } from '../lib/helplines';

/** Taiwan's helplines, with tap-to-call numbers. */
export default function Helplines() {
  return (
    <>
      <ul className="helplines">
        {HELPLINES.map(h => (
          <li key={h.number}>
            <span>{h.name}{h.note && <small>{h.note}</small>}</span>
            <a href={`tel:${h.number}`}>{h.number}</a>
          </li>
        ))}
      </ul>
      <p className="tiny">如果有立即的危險，請打 119 或 110。</p>
    </>
  );
}
