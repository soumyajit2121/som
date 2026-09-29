export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="bg-brand-700 mx-auto grid h-14 w-14 place-items-center rounded-full text-3xl"
          >
            🏏
          </span>
          <p className="text-brand-800 mt-3 text-xl font-bold">Cricket Team Manager</p>
        </div>
        <div className="border-line rounded-xl border bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
