import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
      <section className="card w-full space-y-4 text-center">
        <h1 className="page-title text-2xl">无访问权限</h1>
        <p className="page-subtitle">当前账号没有访问该页面的权限。</p>
        <Link className="btn-primary w-full" href="/dashboard">
          返回学习面板
        </Link>
      </section>
    </main>
  );
}
