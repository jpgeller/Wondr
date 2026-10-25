// Keep older, wordier plans compact too. New plans are prompted to be this brief.
export function stopSummary(description: string): string {
  const sentences = Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(description.trim()));
  const text = sentences.slice(0, 2).map((part) => part.segment).join('').trim();
  const words = text.split(/\s+/).slice(0, 35).join(' ');
  if (words.length <= 240 && words === text) return words;
  const short = words.length > 240 ? words.slice(0, 237).replace(/\s+\S*$/, '') : words;
  return short.replace(/[.,;:!?]+$/, '') + '…';
}
