'use client';

import { useParams } from 'next/navigation';
import { LineupView } from '@/components/lineup/LineupView';

export default function LineupPage() {
  const { id: leagueId } = useParams<{ id: string }>();

  return <LineupView leagueId={leagueId} />;
}
