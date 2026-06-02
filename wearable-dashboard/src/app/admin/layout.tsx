import { AdminSidebar } from '@/components/AdminSidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/');
  }
  return (
    <div className="layout-admin">
      <AdminSidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}
