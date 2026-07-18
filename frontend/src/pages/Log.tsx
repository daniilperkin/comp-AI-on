import LogForm from "@/components/LogForm";

export default function Log() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log entry</h1>
        <p className="text-sm text-muted-foreground">
          Capture every field. Only a model, category, or description is required.
        </p>
      </div>
      <LogForm />
    </div>
  );
}
