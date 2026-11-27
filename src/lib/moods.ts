// 心情輪: the moods, in eight families from heavy to light, then the body. Moods are kept as plain words,
// so a record from before (the twelve words the app started with) still reads, and still shows as picked.
import type { RoadNote, Session } from '../types';

export interface MoodFamily {
  name: string;
  words: string[];
}

export const MOOD_FAMILIES: MoodFamily[] = [
  { name: '沉沉的', words: ['難過', '疲累', '失落', '低落', '沮喪', '想哭', '孤單', '寂寞', '委屈', '心酸', '無力', '提不起勁', '失望', '捨不得', '懷念', '被遺忘', '撐著'] },
  { name: '緊緊的', words: ['焦慮', '緊張', '擔心', '不安', '害怕', '壓力大', '喘不過氣', '坐立難安', '慌張', '心急', '怕被討厭', '放不下', '繃著', '想逃'] },
  { name: '刺刺的', words: ['生氣', '煩躁', '不耐煩', '不甘心', '討厭', '被冒犯', '嫉妒', '丟臉', '後悔', '自責', '罪惡感', '不公平', '受傷', '被誤會'] },
  { name: '霧霧的', words: ['困惑', '空空的', '說不出來', '麻麻的', '迷惘', '茫然', '卡住', '不知道要什麼', '恍惚', '抽離', '矛盾', '混亂', '懷疑自己', '沒感覺'] },
  { name: '輕輕的', words: ['平靜', '輕鬆', '安心', '放鬆', '自在', '舒服', '鬆一口氣', '慢慢來', '還可以', '普通', '穩穩的', '安靜'] },
  { name: '暖暖的', words: ['感謝', '被理解', '被接住', '溫暖', '被陪伴', '感動', '親近', '被愛', '想念', '心疼自己', '溫柔', '被支持'] },
  { name: '亮亮的', words: ['有希望', '開心', '期待', '有勇氣', '好奇', '有成就感', '驕傲', '有力氣', '興奮', '有動力', '想清楚了', '想試試看'] },
  { name: '身體', words: ['好累', '好睏', '睡不好', '頭痛', '胸口悶', '胃不舒服', '肩膀僵硬', '沒胃口', '心跳很快', '手腳冰冷', '想躺著', '身體很重', '喉嚨卡卡的'] }
];

export const ALL_MOODS = MOOD_FAMILIES.flatMap(f => f.words);

/** The family a word is in; -1 for a word you wrote yourself. */
export const familyOf = (word: string) => MOOD_FAMILIES.findIndex(f => f.words.includes(word));

/** Words that have the search in them (or whose family does), in the wheel's order. */
export function findMoods(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  return MOOD_FAMILIES.flatMap(f => (f.name.includes(q) ? f.words : f.words.filter(w => w.includes(q)))).filter((w, i, all) => all.indexOf(w) === i);
}

/** The longest a mood you write yourself can be. */
export const MOOD_MAX = 12;

/**
 * From the records: the moods used lately (newest first, each once) and the moods of the last record that had any.
 * skip leaves out the record being written or changed, so 「跟上次一樣」 means the one before it.
 */
export function moodHistory(
  sessions: Pick<Session, 'id' | 'date' | 'moods' | 'createdAt'>[],
  notes: Pick<RoadNote, 'id' | 'date' | 'moods' | 'createdAt'>[],
  skip: { session?: string; day?: string } = {},
  count = 8
): { recent: string[]; last: string[] } {
  const records = [
    ...sessions.filter(s => s.id !== skip.session),
    ...notes.filter(n => n.date !== skip.day)
  ]
    .filter(r => r.moods && r.moods.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const recent: string[] = [];
  for (const r of records) {
    for (const m of r.moods!) if (!recent.includes(m)) recent.push(m);
    if (recent.length >= count) break;
  }
  return { recent: recent.slice(0, count), last: records[0]?.moods ?? [] };
}
