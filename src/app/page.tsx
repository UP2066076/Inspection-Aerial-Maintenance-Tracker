import { DroneInspectionForm } from '@/components/drone-inspection-form';

export default function Home() {
  return (
    <main className="container mx-auto p-4 py-8 md:p-12">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-primary-foreground">
            INSPECTION +
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
