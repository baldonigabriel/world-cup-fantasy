'use client';

import { useParams } from 'next/navigation';
import { RoundsAdminView } from '@/components/leagues/RoundsAdminView';

export default function RoundsAdminPage() {
  const { id: leagueId } = useParams<{ id: string }>();

  return <RoundsAdminView leagueId={leagueId} />;
}
