# 🎈 AdvancedFloatingBalloonsAR

Продакшн-ready immersive **3D + WebXR-AR** превью для интернет-магазина воздушных
шаров. Одна кнопка на карточке товара → полноэкранная сцена с физически
правдоподобным парением, bloom-свечением, сменой композиций/цветов, фото-снимком
и запуском камеры телефона в дополненной реальности.

![stack](https://img.shields.io/badge/Next.js-15-black) ![r3f](https://img.shields.io/badge/react--three--fiber-9-blueviolet) ![xr](https://img.shields.io/badge/WebXR-immersive--ar-ff69b4)

---

## ✨ Возможности

- **PBR-материалы** — clearcoat / metalness / roughness / emissive; отдельно
  «фольга» и «латекс».
- **Реалистичное парение** — `useFrame` + комбинация sine/cosine + детерминированный
  value-noise + критически-затухающий damping (пружинистость). Наклон в сторону
  движения, лёгкое вращение, «дыхание» всей связки.
- **Post-processing** — Bloom (свечение), N8AO (ambient occlusion), Vignette.
- **4 готовые композиции** — при смене меняются палитра, количество и размеры шаров.
- **Живая смена цвета** всех шаров через материал (плавный lerp).
- **📸 Фото** сцены (`toDataURL`) + сохранение PNG.
- **🎨 Случайная композиция**, **🔄 auto-rotate**, **OrbitControls**.
- **📱 AR Mode** — `immersive-ar` через `@react-three/xr` с проверкой поддержки.
- **Loading / poster**, полностью **responsive & mobile-first**, safe-area insets.

---

## 📦 Установка

```bash
# основные зависимости
npm install three @react-three/fiber @react-three/drei @react-three/xr \
  @react-three/postprocessing framer-motion

# типы (dev)
npm install -D @types/three
```

> Проект предполагает уже настроенный **Next.js 15 (App Router) + TypeScript + Tailwind**.
> Если стартуете с нуля:
>
> ```bash
> npx create-next-app@latest ar-sharoduwi --typescript --tailwind --app --src-dir
> cd ar-sharoduwi
> npm install three @react-three/fiber @react-three/drei @react-three/xr \
>   @react-three/postprocessing framer-motion
> npm install -D @types/three
> ```

### Совместимость версий

| Пакет | Версия | Примечание |
|---|---|---|
| `next` | `^15` | App Router |
| `react` / `react-dom` | `^19` | R3F v9 требует React 19 |
| `@react-three/fiber` | `^9` | |
| `@react-three/drei` | `^10` | |
| `@react-three/xr` | `^6` | новый `createXRStore` API |
| `@react-three/postprocessing` | `^3` | |
| `three` | `^0.171` | |

---

## 🚀 Использование в странице товара

Компонент рендерится **только на клиенте** (WebGL/WebXR + `navigator`), поэтому
подключается через `next/dynamic` с `ssr: false`. Важно: в Next.js 15
`ssr: false` **запрещён внутри Server Component**, поэтому динамический импорт
живёт в тонкой клиентской обёртке [`BalloonsARClient`](src/components/BalloonsARClient.tsx):

```tsx
// src/components/BalloonsARClient.tsx
'use client';
import dynamic from 'next/dynamic';
import type { AdvancedFloatingBalloonsARProps } from './AdvancedFloatingBalloonsAR';

const AdvancedFloatingBalloonsAR = dynamic(
  () => import('./AdvancedFloatingBalloonsAR'),
  { ssr: false },
);

export default function BalloonsARClient(props: AdvancedFloatingBalloonsARProps) {
  return <AdvancedFloatingBalloonsAR {...props} />;
}
```

А серверная страница товара использует обёртку как обычный компонент:

```tsx
// src/app/product/page.tsx  (Server Component)
import BalloonsARClient from '@/components/BalloonsARClient';

export default function ProductPage() {
  return (
    <BalloonsARClient
      productName='Связка «Розовая мечта»'
      initialCompositionId="romantic"
    />
  );
}
```

Готовый пример — в [`src/app/product/page.tsx`](src/app/product/page.tsx).
Тяжёлая three.js-сцена при этом **лениво подгружается** и не попадает в
first-load JS страницы.

### Props

| Prop | Тип | По умолчанию | Описание |
|---|---|---|---|
| `productName` | `string` | `'Композиция из шаров'` | Заголовок в шапке immersive-режима |
| `initialCompositionId` | `string` | первая композиция | Стартовая композиция |
| `compositions` | `CompositionPreset[]` | `COMPOSITIONS` | Свои композиции |
| `triggerClassName` | `string` | `''` | Класс для кнопки-триггера |

Тип `CompositionPreset` и массив `COMPOSITIONS` экспортируются — можно собрать
свои палитры/связки.

---

## 🧩 Подключение своих `.glb` моделей

По умолчанию шары строятся процедурно (никаких ассетов не нужно). Чтобы
использовать собственную модель:

1. Положите файл в `public/models/balloon.glb`.
2. В компоненте раскомментируйте импорт `useGLTF` из `@react-three/drei`.
3. Замените `<Balloon/>` на GLB-версию (готовый сниппет — в комментарии
   `GLB_MODEL_HOWTO` внутри `AdvancedFloatingBalloonsAR.tsx`):

   ```tsx
   function GLBBalloon({ spec, colorOverride }: BalloonProps) {
     const { scene } = useGLTF('/models/balloon.glb');
     const cloned = useMemo(() => scene.clone(true), [scene]);

     useEffect(() => {
       cloned.traverse((o) => {
         const mesh = o as THREE.Mesh;
         if (mesh.isMesh) {
           const m = mesh.material as THREE.MeshStandardMaterial;
           m.color.set(colorOverride ?? spec.color);
           m.emissive.set(colorOverride ?? spec.color);
           m.emissiveIntensity = 0.2;
         }
       });
     }, [cloned, colorOverride, spec.color]);

     return <primitive object={cloned} position={spec.position} scale={spec.scale} />;
   }
   ```

4. Один раз вызовите предзагрузку (вне компонента):

   ```tsx
   useGLTF.preload('/models/balloon.glb');
   ```

5. Физику парения (`useFrame` из `<Balloon/>`) можно обернуть вокруг
   `<primitive/>` — вынесите её в общий хук и переиспользуйте.

> 💡 Оптимизация: прогоните `.glb` через `gltf-transform optimize` или
> `gltfjsx` (сгенерирует типизированный React-компонент) для minified-геометрии
> и Draco/Meshopt-сжатия.

---

## 📱 О WebXR (AR через камеру)

- Работает на Android (Chrome) и совместимых WebXR-браузерах; требует **HTTPS**
  (или `localhost`). На iOS Safari `immersive-ar` пока не поддерживается — кнопка
  «Открыть камеру» автоматически становится недоступной, но 3D-превью работает.
- Компонент сам проверяет `navigator.xr.isSessionSupported('immersive-ar')` и
  отключает AR-кнопку, если поддержки нет.
- Для iOS-«AR Quick Look» можно дополнительно отдавать `.usdz` через
  `<a rel="ar">` — это отдельный нативный путь, не относящийся к WebXR.

---

## 🗂 Структура

```
src/
├─ app/
│  └─ product/page.tsx        # пример карточки товара
└─ components/
   ├─ AdvancedFloatingBalloonsAR.tsx   # весь компонент (self-contained)
   └─ BalloonsARClient.tsx             # client-обёртка (dynamic ssr:false)
```
