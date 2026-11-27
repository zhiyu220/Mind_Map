import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { MOOD_FAMILIES, MOOD_MAX, familyOf, findMoods, moodHistory } from '../lib/moods';

interface Props {
  value: string[];
  onChange: (moods: string[]) => void;
  /** the record being written or changed, left out of 最近用過 and 跟上次一樣 */
  skip?: { session?: string; day?: string };
}

/**
 * 心情輪: find a word or write your own, pick again from the ones used lately or the same as last time,
 * or look through eight families. As many as you like; no scores.
 */
export default function MoodPicker({ value, onChange, skip }: Props) {
  const history = useLiveQuery(async () => moodHistory(await db.sessions.toArray(), await db.notes.toArray(), skip), [skip?.session, skip?.day]);
  const [query, setQuery] = useState('');
  // open on the family of a word already picked, so a record being changed shows where it was
  const [fam, setFam] = useState(() => Math.max(0, value.map(familyOf).find(i => i >= 0) ?? 0));
  const toggle = (m: string) => onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m]);
  const q = query.trim().slice(0, MOOD_MAX);
  const found = findMoods(q);
  const recent = history?.recent ?? [];
  const last = history?.last ?? [];
  const sameAsLast = last.length > 0 && last.length === value.length && last.every(m => value.includes(m));

  const chip = (m: string) => (
    <button key={m} className="chip" type="button" aria-pressed={value.includes(m)} onClick={() => toggle(m)}>
      {m}
    </button>
  );

  return (
    <div className="moods">
      <form
        className="mood-find"
        role="search"
        onSubmit={e => {
          // Enter: the first word found, or what you wrote as it is
          e.preventDefault();
          const m = found[0] ?? q;
          if (m && !value.includes(m)) onChange([...value, m]);
          setQuery('');
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
        <input id="mood-find" type="search" enterKeyHint="done" aria-label="找一個詞，或自己寫" placeholder="找一個詞，或自己寫" maxLength={MOOD_MAX}
          value={query} onChange={e => setQuery(e.target.value)} />
      </form>

      {(value.length > 0 || last.length > 0) && (
        <div className="mood-picked" aria-label="選了的心情">
          {value.map(m => (
            <button key={m} className="chip on" type="button" aria-label={`不選「${m}」`} onClick={() => toggle(m)}>
              {m}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8" /></svg>
            </button>
          ))}
          {last.length > 0 && !sameAsLast && (
            <button className="chip same" type="button" title={last.join('・')} onClick={() => onChange([...last])}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v4h4" /></svg>跟上次一樣
            </button>
          )}
        </div>
      )}

      {q ? (
        <div className="mood-results">
          <div className="chips">
            {found.map(chip)}
            {!found.includes(q) && !value.includes(q) && (
              <button className="chip add" type="button" onClick={() => (onChange([...value, q]), setQuery(''))}>
                ＋ 加上「{q}」
              </button>
            )}
          </div>
          {!found.length && <p className="tiny">沒有找到一樣的詞，可以用自己的話。</p>}
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <div className="mood-recent">
              <span className="label">最近用過</span>
              <div className="chips row">{recent.map(chip)}</div>
            </div>
          )}
          <div className="mood-tabs" role="tablist" aria-label="心情的種類">
            {MOOD_FAMILIES.map((f, i) => (
              <button key={f.name} id={`mood-tab-${i}`} type="button" role="tab" aria-selected={i === fam} aria-controls="mood-words"
                className={f.words.some(w => value.includes(w)) ? 'has' : undefined} onClick={() => setFam(i)}>
                {f.name}
              </button>
            ))}
          </div>
          <div id="mood-words" className="chips" role="tabpanel" aria-labelledby={`mood-tab-${fam}`}>
            {MOOD_FAMILIES[fam].words.map(chip)}
          </div>
        </>
      )}
    </div>
  );
}
