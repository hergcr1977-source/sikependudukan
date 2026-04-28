import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import HomePage from '@/components/HomePage';

// Force dynamic rendering — jangan pernah cache halaman ini
export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <HomePage
      initialRole={session.role}
      initialNama={session.nama}
      initialRtId={session.rtId}
      initialRtInfo={session.rtInfo}
    />
  );
}
