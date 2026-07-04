import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-fuchsia-50 to-cyan-50 p-6 text-center">
      <div className="text-7xl">🎈</div>
      <h1 className="text-3xl font-extrabold text-gray-900 sm:text-5xl">
        AR Sharoduwi
      </h1>
      <p className="max-w-md text-gray-600">
        Живые парящие композиции из воздушных шаров в 3D и дополненной реальности.
      </p>
      <Link
        href="/product"
        className="rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-fuchsia-500/25 transition-transform hover:scale-105"
      >
        Открыть пример товара →
      </Link>
    </main>
  );
}
