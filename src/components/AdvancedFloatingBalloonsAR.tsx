'use client';

/**
 * AdvancedFloatingBalloonsAR
 * ---------------------------------------------------------------------------
 * Продакшн-ready immersive 3D + WebXR-AR превью для магазина воздушных шаров.
 *
 * Стек:
 *   next@15 (App Router) · react · typescript · tailwind · framer-motion
 *   three · @react-three/fiber · @react-three/drei · @react-three/xr
 *   @react-three/postprocessing
 *
 * Особенности:
 *   • PBR-материалы (clearcoat / metalness / roughness / emissive)
 *   • Физически-правдоподобное парение (sine+cosine + damping + value-noise)
 *   • Bloom / selective glow через postprocessing
 *   • 4 готовые композиции + живая смена цвета всех шаров
 *   • Фото-снимок сцены (toDataURL), рандом-композиция
 *   • OrbitControls + auto-rotate в preview, WebXR immersive-ar
 *   • Loading / poster, полностью responsive & mobile-first
 *
 * Подключение собственных .glb моделей — см. секцию GLB_MODEL_HOWTO ниже.
 * ---------------------------------------------------------------------------
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Float,
  Html,
  OrbitControls,
  useProgress,
  // useGLTF,  // ← раскомментируйте для GLB (см. GLB_MODEL_HOWTO)
} from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import * as THREE from 'three';

/* ======================================================================== *
 *  ТИПЫ И КОНФИГУРАЦИЯ КОМПОЗИЦИЙ
 * ======================================================================== */

export interface BalloonSpec {
  /** Позиция центра в мировых координатах (метры) */
  position: [number, number, number];
  /** Базовый радиус шара */
  scale: number;
  /** HEX цвет материала */
  color: string;
  /** Индивидуальный сдвиг фазы, чтобы шары не парили синхронно */
  seed: number;
  /** Металлик-фольга или матовый латекс */
  finish: 'foil' | 'latex';
}

export interface CompositionPreset {
  id: string;
  name: string;
  emoji: string;
  /** Палитра для кнопок быстрой смены цвета */
  palette: string[];
  balloons: BalloonSpec[];
}

/**
 * Готовые композиции. Позиции подобраны так, чтобы связка красиво читалась
 * и в preview, и в AR (центр связки на уровне ~1.1м от пола якоря).
 */
export const COMPOSITIONS: CompositionPreset[] = [
  {
    id: 'romantic',
    name: 'Романтика',
    emoji: '💗',
    palette: ['#ff5d8f', '#ff99c8', '#ffd6e0', '#c8b6ff', '#ffffff'],
    balloons: [
      { position: [0, 1.35, 0], scale: 0.5, color: '#ff5d8f', seed: 0.1, finish: 'foil' },
      { position: [-0.62, 0.95, 0.2], scale: 0.4, color: '#ff99c8', seed: 1.7, finish: 'latex' },
      { position: [0.6, 1.05, -0.15], scale: 0.44, color: '#ffd6e0', seed: 3.2, finish: 'latex' },
      { position: [0.15, 0.55, 0.35], scale: 0.36, color: '#c8b6ff', seed: 4.9, finish: 'foil' },
      { position: [-0.28, 0.35, -0.28], scale: 0.3, color: '#ffffff', seed: 6.1, finish: 'latex' },
    ],
  },
  {
    id: 'birthday',
    name: 'День рождения',
    emoji: '🎉',
    palette: ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff'],
    balloons: [
      { position: [0, 1.4, 0], scale: 0.52, color: '#ff006e', seed: 0.4, finish: 'foil' },
      { position: [-0.7, 1.0, 0.15], scale: 0.42, color: '#ffbe0b', seed: 2.1, finish: 'latex' },
      { position: [0.68, 1.1, -0.2], scale: 0.46, color: '#3a86ff', seed: 3.6, finish: 'latex' },
      { position: [-0.2, 0.6, 0.4], scale: 0.38, color: '#8338ec', seed: 5.0, finish: 'foil' },
      { position: [0.32, 0.5, -0.3], scale: 0.34, color: '#fb5607', seed: 6.3, finish: 'latex' },
      { position: [0.02, 0.2, 0.1], scale: 0.28, color: '#ffbe0b', seed: 7.7, finish: 'foil' },
    ],
  },
  {
    id: 'chrome',
    name: 'Хром-люкс',
    emoji: '🪩',
    palette: ['#c0c0c0', '#e5e4e2', '#b76e79', '#d4af37', '#8a9ba8'],
    balloons: [
      { position: [0, 1.35, 0], scale: 0.5, color: '#d4af37', seed: 0.9, finish: 'foil' },
      { position: [-0.6, 1.0, 0.18], scale: 0.42, color: '#c0c0c0', seed: 2.4, finish: 'foil' },
      { position: [0.62, 1.05, -0.18], scale: 0.44, color: '#b76e79', seed: 3.8, finish: 'foil' },
      { position: [0.1, 0.6, 0.34], scale: 0.36, color: '#e5e4e2', seed: 5.5, finish: 'foil' },
    ],
  },
  {
    id: 'pastel',
    name: 'Пастель',
    emoji: '🌸',
    palette: ['#a0c4ff', '#bdb2ff', '#ffc6ff', '#caffbf', '#fdffb6'],
    balloons: [
      { position: [0, 1.32, 0], scale: 0.48, color: '#a0c4ff', seed: 0.2, finish: 'latex' },
      { position: [-0.64, 0.98, 0.2], scale: 0.4, color: '#bdb2ff', seed: 1.9, finish: 'latex' },
      { position: [0.6, 1.02, -0.16], scale: 0.42, color: '#ffc6ff', seed: 3.4, finish: 'latex' },
      { position: [0.16, 0.58, 0.36], scale: 0.34, color: '#caffbf', seed: 5.1, finish: 'latex' },
      { position: [-0.26, 0.4, -0.26], scale: 0.3, color: '#fdffb6', seed: 6.8, finish: 'latex' },
    ],
  },
];

/* ======================================================================== *
 *  WEBXR STORE
 * ======================================================================== */

const xrStore = createXRStore({
  // hand-tracking / controllers нам не нужны для карточки товара — только AR-камера
  hand: false,
  controller: false,
  // domOverlay позволяет держать HTML-панель управления поверх AR-сессии
  domOverlay: true,
});

/* ======================================================================== *
 *  МАТЕМАТИКА ПАРЕНИЯ — детерминированный value-noise (без зависимостей)
 * ======================================================================== */

/** Плавный псевдо-шум в диапазоне [-1, 1]. Детерминирован по seed → без «дёрганья». */
function smoothNoise(t: number, seed: number): number {
  // Сумма несоизмеримых синусоид даёт «органичное» непериодическое колебание
  return (
    0.55 * Math.sin(t * 0.9 + seed * 12.9898) +
    0.3 * Math.cos(t * 1.37 + seed * 78.233) +
    0.15 * Math.sin(t * 2.11 + seed * 37.719)
  );
}

/* ======================================================================== *
 *  ГЕОМЕТРИЯ ШАРА
 * ======================================================================== */

/**
 * Форма настоящего шара: слегка вытянутая сфера с «носиком» снизу.
 * Строим один раз и переиспользуем через useMemo.
 */
function useBalloonGeometry() {
  return useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Вытягиваем вверх (каплевидность) и заостряем низ под узелок
      const stretch = 1 + 0.12 * v.y;
      const pinch = v.y < -0.55 ? 1 + (v.y + 0.55) * 0.9 : 1;
      v.x *= pinch;
      v.z *= pinch;
      v.y *= stretch;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
}

/* ======================================================================== *
 *  ОДИН ШАР
 * ======================================================================== */

interface BalloonProps {
  spec: BalloonSpec;
  /** Переопределение цвета из нижней панели (если null — берём из spec) */
  colorOverride: string | null;
  geometry: THREE.BufferGeometry;
}

function Balloon({ spec, colorOverride, geometry }: BalloonProps) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const color = colorOverride ?? spec.color;

  // Плавная интерполяция цвета при смене палитры
  const targetColor = useMemo(() => new THREE.Color(color), [color]);

  const isFoil = spec.finish === 'foil';

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const s = spec.seed;

    // — Вертикальное парение: несущий sine + шумовая модуляция + затухание —
    const bobBase = Math.sin(t * 0.8 + s) * 0.06;
    const bobNoise = smoothNoise(t * 0.5, s) * 0.05;
    const targetY = spec.position[1] + bobBase + bobNoise;

    // — Боковое качание (drift) —
    const swayX = Math.cos(t * 0.55 + s * 1.3) * 0.045 + smoothNoise(t * 0.4, s + 5) * 0.03;
    const swayZ = Math.sin(t * 0.47 + s * 0.7) * 0.04;
    const targetX = spec.position[0] + swayX;
    const targetZ = spec.position[2] + swayZ;

    // — Damping (критически-затухающее приближение к цели ⇒ «пружинистость») —
    const damp = 1 - Math.pow(0.0015, delta);
    group.current.position.x += (targetX - group.current.position.x) * damp;
    group.current.position.y += (targetY - group.current.position.y) * damp;
    group.current.position.z += (targetZ - group.current.position.z) * damp;

    // — Наклон в сторону движения + лёгкая инерция вращения —
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      -swayX * 1.6,
      damp,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      swayZ * 1.4,
      damp,
    );
    group.current.rotation.y += delta * 0.12 * (0.6 + 0.4 * Math.sin(s));

    // — Плавный переход цвета материала —
    if (material.current) {
      material.current.color.lerp(targetColor, delta * 4);
      material.current.emissive.lerp(targetColor, delta * 4);
    }
  });

  return (
    <group
      ref={group}
      position={spec.position}
      scale={spec.scale}
      // dispose={null} сохраняет геометрию между рендерами
      dispose={null}
    >
      {/* Тело шара */}
      <mesh geometry={geometry} castShadow>
        <meshPhysicalMaterial
          ref={material}
          color={color}
          emissive={color}
          emissiveIntensity={isFoil ? 0.28 : 0.16}
          metalness={isFoil ? 0.9 : 0.05}
          roughness={isFoil ? 0.18 : 0.32}
          clearcoat={1}
          clearcoatRoughness={isFoil ? 0.08 : 0.25}
          sheen={isFoil ? 0 : 0.6}
          sheenColor={color}
          envMapIntensity={isFoil ? 1.4 : 0.8}
          transmission={0}
        />
      </mesh>

      {/* Узелок (носик снизу) */}
      <mesh position={[0, -1.18, 0]} scale={0.12} castShadow>
        <coneGeometry args={[1, 1.6, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={isFoil ? 0.6 : 0.1} />
      </mesh>

      {/* Блик-«хайлайт» — маленькая яркая сфера сверху для «живого» вида */}
      <mesh position={[-0.32, 0.4, 0.7]} scale={0.14}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>

      {/* Ниточка */}
      <mesh position={[0, -2.4, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 2.4, 6]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ======================================================================== *
 *  СВЯЗКА ШАРОВ + ЛЁГКОЕ ОБЩЕЕ ДВИЖЕНИЕ
 * ======================================================================== */

interface BalloonBunchProps {
  preset: CompositionPreset;
  colorOverride: string | null;
}

function BalloonBunch({ preset, colorOverride }: BalloonBunchProps) {
  const geometry = useBalloonGeometry();
  const root = useRef<THREE.Group>(null);

  // Очень медленное «дыхание» всей связки — добавляет цельность сцене
  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    root.current.rotation.y = Math.sin(t * 0.15) * 0.12;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group ref={root}>
      {preset.balloons.map((spec, i) => (
        <Balloon
          key={`${preset.id}-${i}`}
          spec={spec}
          colorOverride={colorOverride}
          geometry={geometry}
        />
      ))}

      {/* Место, куда «сходятся» все ниточки — маленький узел-держатель */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#cfcfcf" roughness={0.7} metalness={0.3} />
      </mesh>

      {/*
        GLB_MODEL_HOWTO — как подключить собственную .glb модель шара/связки:
        --------------------------------------------------------------------
        1. Положите файл в /public/models/balloon.glb
        2. Раскомментируйте `useGLTF` в импортах drei выше.
        3. Замените <Balloon/> на компонент ниже:

            function GLBBalloon({ spec, colorOverride }: BalloonProps) {
              const { scene } = useGLTF('/models/balloon.glb');
              const cloned = useMemo(() => scene.clone(true), [scene]);
              useEffect(() => {
                cloned.traverse((o) => {
                  if ((o as THREE.Mesh).isMesh) {
                    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
                    m.color.set(colorOverride ?? spec.color);
                    m.emissive.set(colorOverride ?? spec.color);
                    m.emissiveIntensity = 0.2;
                  }
                });
              }, [cloned, colorOverride, spec.color]);
              return <primitive object={cloned} position={spec.position} scale={spec.scale} />;
            }
            // и однократно: useGLTF.preload('/models/balloon.glb');

        4. Физику парения (useFrame из <Balloon/>) можно обернуть вокруг <primitive/>.
      */}
    </group>
  );
}

/* ======================================================================== *
 *  СЦЕНА (свет, окружение, пост-обработка)
 * ======================================================================== */

interface SceneProps {
  preset: CompositionPreset;
  colorOverride: string | null;
  arActive: boolean;
  autoRotate: boolean;
}

function Scene({ preset, colorOverride, arActive, autoRotate }: SceneProps) {
  return (
    <>
      {/* Мягкое студийное освещение */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.7} color="#bcd4ff" />
      <pointLight position={[0, 2.5, 2]} intensity={12} color="#ffffff" distance={8} decay={2} />

      {/* HDRI-окружение для честных отражений на фольге */}
      <Environment preset="studio" environmentIntensity={0.9} />

      {/* Плавающая связка. Float добавляет едва заметное «дыхание» поверх физики. */}
      <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.25}>
        <BalloonBunch preset={preset} colorOverride={colorOverride} />
      </Float>

      {/* Контактная тень только в preview (в AR тень рисует реальность) */}
      {!arActive && (
        <ContactShadows
          position={[0, -0.15, 0]}
          opacity={0.45}
          scale={6}
          blur={2.6}
          far={4}
          resolution={512}
          color="#1a1030"
        />
      )}

      {/* Управление камерой — только вне AR-сессии */}
      {!arActive && (
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={2.2}
          maxDistance={7}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.62}
          autoRotate={autoRotate}
          autoRotateSpeed={0.9}
          target={[0, 1, 0]}
        />
      )}

      {/* Пост-обработка: bloom-свечение + мягкое AO + виньетка.
          В AR отключаем — эффекты дороги и ломают прозрачный фон камеры. */}
      {!arActive && (
        <EffectComposer enableNormalPass multisampling={4}>
          <N8AO aoRadius={1.2} intensity={1.4} distanceFalloff={1} />
          <Bloom
            intensity={0.9}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.25}
            mipmapBlur
            radius={0.7}
          />
          <Vignette eskil={false} offset={0.2} darkness={0.65} />
        </EffectComposer>
      )}

      <AdaptiveDpr pixelated />
    </>
  );
}

/* ======================================================================== *
 *  МОСТ ДЛЯ ФОТО-СНИМКА (доступ к gl вне Canvas)
 * ======================================================================== */

function CaptureBridge({ onReady }: { onReady: (fn: () => string) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

/* ======================================================================== *
 *  LOADING / POSTER
 * ======================================================================== */

function Loader() {
  const { progress, active } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 animate-ping rounded-full bg-fuchsia-500/30" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🎈</div>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400 transition-[width] duration-300"
            style={{ width: `${active ? progress : 100}%` }}
          />
        </div>
        <span className="text-xs font-medium tracking-wide text-white/70">
          Надуваем шары… {Math.round(progress)}%
        </span>
      </div>
    </Html>
  );
}

/* ======================================================================== *
 *  UI-КОНТРОЛЫ (нижняя панель)
 * ======================================================================== */

interface ControlsProps {
  presets: CompositionPreset[];
  activePreset: CompositionPreset;
  onSelectPreset: (id: string) => void;
  activeColor: string | null;
  onSelectColor: (c: string | null) => void;
  onPhoto: () => void;
  onRandom: () => void;
  onEnterAR: () => void;
  arSupported: boolean;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
}

function Controls({
  presets,
  activePreset,
  onSelectPreset,
  activeColor,
  onSelectColor,
  onPhoto,
  onRandom,
  onEnterAR,
  arSupported,
  autoRotate,
  onToggleAutoRotate,
}: ControlsProps) {
  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, delay: 0.15 }}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[env(safe-area-inset-bottom)] sm:px-6"
    >
      <div className="mx-auto mb-4 w-full max-w-3xl rounded-3xl border border-white/15 bg-black/40 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
        {/* Ряд: выбор композиции */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {presets.map((p) => {
            const active = p.id === activePreset.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPreset(p.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-white text-black shadow-lg'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <span className="text-base">{p.emoji}</span>
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Ряд: цветовые круги */}
        <div className="mb-3 flex items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 pr-1 text-xs font-medium uppercase tracking-wider text-white/50">
            Цвет
          </span>
          {/* «Авто» — вернуть родные цвета композиции */}
          <button
            aria-label="Родные цвета композиции"
            onClick={() => onSelectColor(null)}
            className={`h-8 w-8 shrink-0 rounded-full border-2 bg-[conic-gradient(from_0deg,#ff5d8f,#ffbe0b,#3a86ff,#8338ec,#ff5d8f)] transition-transform hover:scale-110 ${
              activeColor === null ? 'border-white ring-2 ring-white/40' : 'border-white/30'
            }`}
          />
          {activePreset.palette.map((c) => (
            <button
              key={c}
              aria-label={`Цвет ${c}`}
              onClick={() => onSelectColor(c)}
              style={{ backgroundColor: c }}
              className={`h-8 w-8 shrink-0 rounded-full border-2 transition-transform hover:scale-110 ${
                activeColor === c ? 'border-white ring-2 ring-white/40' : 'border-white/30'
              }`}
            />
          ))}
        </div>

        {/* Ряд: действия */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActionButton onClick={onPhoto} label="Фото" emoji="📸" />
          <ActionButton onClick={onRandom} label="Случайно" emoji="🎨" />
          <ActionButton
            onClick={onToggleAutoRotate}
            label={autoRotate ? 'Стоп' : 'Вращать'}
            emoji={autoRotate ? '⏸️' : '🔄'}
          />
          <ActionButton
            onClick={onEnterAR}
            label={arSupported ? 'Открыть камеру' : 'AR н/д'}
            emoji="📱"
            disabled={!arSupported}
            primary
          />
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({
  onClick,
  label,
  emoji,
  primary,
  disabled,
}: {
  onClick: () => void;
  label: string;
  emoji: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50'
          : 'bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      <span className="text-base">{emoji}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ======================================================================== *
 *  ГЛАВНЫЙ КОМПОНЕНТ
 * ======================================================================== */

export interface AdvancedFloatingBalloonsARProps {
  /** Название товара — показывается в шапке immersive-режима */
  productName?: string;
  /** Стартовая композиция */
  initialCompositionId?: string;
  /** Кастомные композиции (перекрывают дефолтные) */
  compositions?: CompositionPreset[];
  /** Класс для внешней кнопки-триггера */
  triggerClassName?: string;
}

export default function AdvancedFloatingBalloonsAR({
  productName = 'Композиция из шаров',
  initialCompositionId,
  compositions = COMPOSITIONS,
  triggerClassName = '',
}: AdvancedFloatingBalloonsARProps) {
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState(
    initialCompositionId ?? compositions[0].id,
  );
  const [colorOverride, setColorOverride] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [arSupported, setArSupported] = useState(false);
  const [arActive, setArActive] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const captureFn = useRef<(() => string) | null>(null);

  const activePreset = useMemo(
    () => compositions.find((c) => c.id === presetId) ?? compositions[0],
    [compositions, presetId],
  );

  // — Проверка поддержки WebXR immersive-ar —
  useEffect(() => {
    let cancelled = false;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (xr?.isSessionSupported) {
      xr
        .isSessionSupported('immersive-ar')
        .then((ok) => !cancelled && setArSupported(ok))
        .catch(() => !cancelled && setArSupported(false));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // — Блокируем скролл body в immersive-режиме —
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // — Отслеживаем выход из AR-сессии (кнопка «назад» гарнитуры/телефона) —
  useEffect(() => {
    return xrStore.subscribe((s) => setArActive(!!s.session));
  }, []);

  const handleClose = useCallback(() => {
    if (arActive) xrStore.getState().session?.end().catch(() => {});
    setOpen(false);
    setArActive(false);
  }, [arActive]);

  const handleEnterAR = useCallback(async () => {
    try {
      await xrStore.enterAR();
    } catch {
      // Пользователь отклонил доступ к камере или устройство не поддерживает
      setArSupported(false);
    }
  }, []);

  const handlePhoto = useCallback(() => {
    if (!captureFn.current) return;
    const dataUrl = captureFn.current();
    setSnapshot(dataUrl);
  }, []);

  const handleRandom = useCallback(() => {
    const other = compositions.filter((c) => c.id !== presetId);
    const next = other[Math.floor(Math.random() * other.length)] ?? activePreset;
    setPresetId(next.id);
    // случайный цвет из новой палитры (иногда — родные)
    const roll = Math.random();
    setColorOverride(roll > 0.4 ? next.palette[Math.floor(Math.random() * next.palette.length)] : null);
  }, [compositions, presetId, activePreset]);

  const downloadSnapshot = useCallback(() => {
    if (!snapshot) return;
    const a = document.createElement('a');
    a.href = snapshot;
    a.download = `balloons-${activePreset.id}-${Date.now()}.png`;
    a.click();
  }, [snapshot, activePreset.id]);

  return (
    <>
      {/* ---------- КНОПКА-ТРИГГЕР НА КАРТОЧКЕ ТОВАРА ---------- */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className={`group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-fuchsia-500/25 transition-shadow hover:shadow-fuchsia-500/40 sm:text-lg ${triggerClassName}`}
      >
        {/* Блик, «пробегающий» по кнопке */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="relative flex items-center justify-center gap-2">
          <span className="text-xl">🌊</span>
          Примерить живые парящие шары
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold tracking-wide">
            3D + AR
          </span>
        </span>
      </motion.button>

      {/* ---------- IMMERSIVE ПОЛНОЭКРАННЫЙ РЕЖИМ ---------- */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[9999] bg-gradient-to-b from-[#1a0b2e] via-[#0f0720] to-[#05030f]"
          >
            {/* Декоративное сияние на фоне */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-1/4 top-0 h-[60vh] w-[60vh] rounded-full bg-fuchsia-600/20 blur-[120px]" />
              <div className="absolute -right-1/4 bottom-0 h-[60vh] w-[60vh] rounded-full bg-cyan-500/20 blur-[120px]" />
            </div>

            {/* Шапка */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-md">
                  {arActive ? '📷 AR активен' : '🪄 3D-превью'}
                </span>
                <h2 className="mt-2 max-w-[70vw] truncate text-lg font-bold text-white sm:text-2xl">
                  {productName}
                </h2>
              </motion.div>

              <button
                onClick={handleClose}
                aria-label="Закрыть"
                className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                ✕
              </button>
            </div>

            {/* CANVAS */}
            <Canvas
              shadows
              dpr={[1, 2]}
              camera={{ position: [0, 1.2, 4.2], fov: 42 }}
              gl={{
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: true, // нужно для toDataURL (фото)
                powerPreference: 'high-performance',
              }}
              className="absolute inset-0"
            >
              <color attach="background" args={['#0f0720']} />
              <fog attach="fog" args={['#0f0720', 6, 14]} />

              <XR store={xrStore}>
                {/* XROrigin позиционирует связку на удобной высоте перед пользователем в AR */}
                <XROrigin position={[0, 0, 0]} />
                <Suspense fallback={<Loader />}>
                  <Scene
                    preset={activePreset}
                    colorOverride={colorOverride}
                    arActive={arActive}
                    autoRotate={autoRotate}
                  />
                  <CaptureBridge onReady={(fn) => (captureFn.current = fn)} />
                </Suspense>
              </XR>
            </Canvas>

            {/* Нижняя панель управления */}
            <Controls
              presets={compositions}
              activePreset={activePreset}
              onSelectPreset={setPresetId}
              activeColor={colorOverride}
              onSelectColor={setColorOverride}
              onPhoto={handlePhoto}
              onRandom={handleRandom}
              onEnterAR={handleEnterAR}
              arSupported={arSupported}
              autoRotate={autoRotate}
              onToggleAutoRotate={() => setAutoRotate((v) => !v)}
            />

            {/* ---------- МОДАЛКА СНИМКА ---------- */}
            <AnimatePresence>
              {snapshot && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
                  onClick={() => setSnapshot(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md rounded-3xl border border-white/15 bg-[#160a2a] p-4 shadow-2xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={snapshot}
                      alt="Снимок композиции"
                      className="w-full rounded-2xl"
                    />
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={downloadSnapshot}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 py-3 font-semibold text-white transition-transform active:scale-95"
                      >
                        ⬇️ Сохранить
                      </button>
                      <button
                        onClick={() => setSnapshot(null)}
                        className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/20"
                      >
                        Закрыть
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ======================================================================== *
 *  (опционально) предзагрузка GLB — держите вне компонента:
 *  useGLTF.preload('/models/balloon.glb');
 * ======================================================================== */
