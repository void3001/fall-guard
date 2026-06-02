import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WorkerLayoutClient from './layout-client';

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'worker') {
    redirect('/');
  }
  return (
    <WorkerLayoutClient username={session.username}>
      {children}
    </WorkerLayoutClient>
  );
}
