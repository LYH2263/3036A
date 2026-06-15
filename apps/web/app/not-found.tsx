import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
      <section className="card w-full space-y-4 text-center">
        <h1 className="page-title text-2xl">页面不存在</h1>
        <p className="page-subtitle">你访问的页面可能已移动或链接错误。</p>
        <Link className="btn-primary w-full" href="/auth">
          返回登录页
        </Link>
      </section>
    </main>
  );
}
