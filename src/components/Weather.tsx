import type { Weather } from '../types';
import { WEATHERS, WEATHER_NAME } from '../types';

export function WeatherIcon({ w, className }: { w: Weather; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 60" aria-hidden="true">
      <use href={`#w-${w}`} />
    </svg>
  );
}

/** The five weathers as big buttons (session day) or a small row (road notes). */
export function WeatherPicker({ value, onChange, small }: { value?: Weather | null; onChange: (w: Weather | null) => void; small?: boolean }) {
  return (
    <div className={small ? 'mini' : 'weathers'} role="group" aria-label="天氣">
      {WEATHERS.map(w => (
        <button
          key={w}
          className="wbtn"
          type="button"
          aria-pressed={value === w}
          aria-label={small ? WEATHER_NAME[w] : undefined}
          onClick={() => onChange(small && value === w ? null : w)}
        >
          <WeatherIcon w={w} />
          {!small && WEATHER_NAME[w]}
        </button>
      ))}
    </div>
  );
}

export function StarIcon() {
  return (
    <svg aria-hidden="true">
      <use href="#i-star" />
    </svg>
  );
}
