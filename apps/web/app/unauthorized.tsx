import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
      <section className="card w-full space-y-4 text-center">
        <h1 className="page-title text-2xl">登录状态已失效</h1>
        <p className="page-subtitle">请重新登录后继续使用。</p>
        <Link className="btn-primary w-full" href="/auth">
          前往登录
        </Link>
      </section>
    </main>
  );
}
