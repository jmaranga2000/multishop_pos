export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
    {actions}
  </div>;
}
