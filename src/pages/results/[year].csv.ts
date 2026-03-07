import type { GetStaticPaths } from 'astro';
import {
  getEditionYears,
  loadEdition,
  participantName,
  countryName,
  loadCountries,
} from '../../lib/data';
import { computeAwards } from '../../lib/awards';
import { rankParticipants } from '../../lib/stats';

export const getStaticPaths: GetStaticPaths = () => {
  const years = getEditionYears();
  return [
    ...years.map((y) => ({ params: { year: String(y) } })),
    { params: { year: 'all' } },
  ];
};

export function GET({ params }: { params: { year: string } }) {
  const { year } = params;
  const countries = loadCountries();
  const years = year === 'all' ? getEditionYears() : [Number(year)];

  const header = 'Year,Rank,Name,Country,P1,P2,P3,P4,Total,Award';
  const rows: string[] = [];

  for (const y of years) {
    const ed = loadEdition(y)!;
    const withAwards = computeAwards(
      ed.participants,
      ed.thresholds,
      ed.honourableMentions,
    );
    const ranked = rankParticipants(withAwards);

    for (const p of ranked) {
      const name = participantName(p).replace(/"/g, '""');
      const cname = countryName(p.country, countries).replace(/"/g, '""');
      rows.push(
        `${y},${p.rank},"${name}","${cname}",${p.scores[0]},${p.scores[1]},${p.scores[2]},${p.scores[3]},${p.totalScore},${p.award || ''}`,
      );
    }
  }

  const csv = header + '\n' + rows.join('\n') + '\n';

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
    },
  });
}
