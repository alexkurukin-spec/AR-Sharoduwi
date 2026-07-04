import BalloonsARClient from '@/components/BalloonsARClient';

/**
 * Пример страницы товара с AR-примеркой.
 *
 * Это Server Component. Тяжёлая WebGL/WebXR-сцена подключается через клиентскую
 * обёртку `BalloonsARClient`, которая делает `next/dynamic({ ssr: false })` внутри
 * client-границы — так исключаются SSR-ошибки («window is not defined») и лишний
 * серверный рендер three.js.
 */
export default function ProductPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Галерея товара */}
        <div className="aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-100 to-cyan-100">
          <div className="flex h-full items-center justify-center text-8xl">🎈</div>
        </div>

        {/* Инфо о товаре */}
        <div className="flex flex-col justify-center">
          <span className="mb-2 inline-block w-fit rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700">
            Хит продаж
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Связка «Розовая мечта»
          </h1>
          <p className="mt-3 text-gray-600">
            15 гелиевых шаров премиум-класса с фольгированными акцентами.
            Примерьте композицию в вашем интерьере прямо через камеру телефона.
          </p>
          <div className="mt-5 text-3xl font-bold text-gray-900">3 490 ₽</div>

          {/* ⭐ AR-ПРИМЕРКА */}
          <div className="mt-6">
            <BalloonsARClient
              productName='Связка «Розовая мечта»'
              initialCompositionId="romantic"
            />
          </div>

          <button className="mt-3 w-full rounded-2xl border-2 border-gray-900 py-4 text-base font-bold text-gray-900 transition-colors hover:bg-gray-900 hover:text-white">
            🛒 В корзину
          </button>
        </div>
      </div>
    </main>
  );
}
