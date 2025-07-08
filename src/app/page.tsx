import { DroneInspectionForm } from '@/components/drone-inspection-form';

export default function Home() {
  return (
    <main className="container mx-auto p-4 py-8 md:p-12">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-primary-foreground">
            DroneForm
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Complete the fields below to generate your inspection report.
          </p>
          <p className="mt-2 text-sm text-muted-foreground/80">
            Note: This application requires `template.docx` and `template.xlsx` in the `public` folder.
          </p>
        </div>
        <DroneInspectionForm />
      </div>
    </main>
  );
}
