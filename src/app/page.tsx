
import { DroneInspectionForm } from '@/components/drone-inspection-form';
import { redirect } from 'next/navigation';
import { verifyAuth } from '@/lib/auth';

export const revalidate = 0;

export default async function Home() {
  const auth = await verifyAuth();

  if (!auth.user) {
    redirect('/login');
  }

  return (
    <main className="container mx-auto p-4 py-8 md:p-12">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-primary-foreground">
            ired INSEPCTON +
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            DRONE HEALTH CHECK
          </p>
        </div>
        <DroneInspectionForm />
      </div>
    </main>
  );
}
