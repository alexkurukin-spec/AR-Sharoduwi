'use client';

import dynamic from 'next/dynamic';
import type { AdvancedFloatingBalloonsARProps } from './AdvancedFloatingBalloonsAR';

/**
 * Клиентская обёртка для AR-компонента.
 *
 * В Next.js 15 `next/dynamic` с `ssr: false` запрещён внутри Server Components,
 * поэтому динамический импорт (который отключает SSR тяжёлой WebGL/WebXR-сцены)
 * живёт здесь, в client-границе. Серверная страница товара импортирует уже
 * этот компонент как обычно.
 */
const AdvancedFloatingBalloonsAR = dynamic(
  () => import('./AdvancedFloatingBalloonsAR'),
  {
    ssr: false,
    loading: () => (
      <div className="h-14 w-full animate-pulse rounded-2xl bg-gradient-to-r from-fuchsia-600/40 to-cyan-500/40" />
    ),
  },
);

export default function BalloonsARClient(props: AdvancedFloatingBalloonsARProps) {
  return <AdvancedFloatingBalloonsAR {...props} />;
}
