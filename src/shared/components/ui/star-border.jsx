'use client';

import { useEffect, useRef } from 'react';

import styles from './star-border.module.css';

const THEMES = {
  dark: {
    surface: '#0c0c0f',
    text: '#fafafa',
    track: 'rgba(255, 255, 255, 0.1)',
    light: '#ffffff',
  },
  light: {
    surface: '#ffffff',
    text: '#18181b',
    track: 'rgba(24, 24, 27, 0.12)',
    light: '#18181b',
  },
};

const BLEED = 48;
const TAU = Math.PI * 2;
const WHITE = [255, 255, 255];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, amount) =>
  a.map((value, index) => value + (b[index] - value) * amount);
const rgba = (color, alpha) =>
  `rgba(${color.map(Math.round).join(', ')}, ${clamp(alpha, 0, 1).toFixed(3)})`;

let colorContext;

function toRgb(color) {
  colorContext ??= document.createElement('canvas').getContext('2d');
  if (!colorContext) return WHITE;
  colorContext.fillStyle = '#000000';
  colorContext.fillStyle = color;
  const value = String(colorContext.fillStyle);
  if (value.startsWith('#')) {
    const hex = Number.parseInt(value.slice(1, 7), 16);
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }
  return value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? WHITE;
}
function pointOnRoundedRect(width, height, radius, distance) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const horizontal = Math.max(0, width - r * 2);
  const vertical = Math.max(0, height - r * 2);
  const corner = (Math.PI * r) / 2;
  const lengths = [horizontal, corner, vertical, corner, horizontal, corner, vertical, corner];
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  let offset = ((distance % total) + total) % total;
  const line = (length, x, y, dx, dy) => ({ x: x + dx * offset, y: y + dy * offset });
  const arc = (cx, cy, start) => {
    const angle = start + offset / Math.max(r, 0.001);
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  for (let index = 0; index < lengths.length; index += 1) {
    if (offset <= lengths[index]) {
      if (index === 0) return { ...line(horizontal, r, 0, 1, 0), total };
      if (index === 1) return { ...arc(width - r, r, -Math.PI / 2), total };
      if (index === 2) return { ...line(vertical, width, r, 0, 1), total };
      if (index === 3) return { ...arc(width - r, height - r, 0), total };
      if (index === 4) return { ...line(horizontal, width - r, height, -1, 0), total };
      if (index === 5) return { ...arc(r, height - r, Math.PI / 2), total };
      if (index === 6) return { ...line(vertical, 0, height - r, 0, -1), total };
      return { ...arc(r, r, Math.PI), total };
    }
    offset -= lengths[index];
  }
  return { x: r, y: 0, total };
}

export default function StarBorder({
  as: Component = 'button',
  children,
  className = '',
  style = {},
  color = '',
  trailColor = '',
  duration = 4,
  direction = 'clockwise',
  stars = 1,
  trailLength = 0.3,
  thickness = 1,
  radius = 12,
  glow = 0.6,
  sparkle = false,
  hover = 'lap',
  clickPulse = true,
  theme = 'dark',
  backgroundColor = '',
  textColor = '',
  borderColor = '',
  ...rest
}) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const settingsRef = useRef({});
  const palette = THEMES[theme] ?? THEMES.dark;
  settingsRef.current = {
    color: color || palette.light,
    trailColor: trailColor || color || palette.light,
    duration: Math.max(0.3, duration),
    direction: direction === 'counterclockwise' ? -1 : 1,
    stars: clamp(Math.round(stars), 1, 6),
    trailLength: clamp(trailLength, 0.04, 0.8),
    thickness: Math.max(0.5, thickness),
    radius: Math.max(0, radius),
    glow: clamp(glow, 0, 1),
    sparkle,
    hover,
    clickPulse,
  };

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!root || !canvas || !context) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frame = 0;
    let last = performance.now();
    let phase = 0;
    let visible = true;
    let engaged = false;
    let pulse = 0;
    let size = { width: 1, height: 1, dpr: 1 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = { width: root.offsetWidth, height: root.offsetHeight, dpr };
      canvas.width = Math.max(1, Math.round((size.width + BLEED * 2) * dpr));
      canvas.height = Math.max(1, Math.round((size.height + BLEED * 2) * dpr));
    };

    const draw = (now) => {
      frame = 0;
      if (!visible) return;
      const settings = settingsRef.current;
      const elapsed = Math.min(0.05, (now - last) / 1000);
      last = now;
      const width = Math.max(1, size.width - settings.thickness);
      const height = Math.max(1, size.height - settings.thickness);
      const shape = pointOnRoundedRect(width, height, settings.radius, 0);
      const speed = reducedMotion ? 0 : shape.total / settings.duration;
      phase = (phase + elapsed * speed * settings.direction) % shape.total;
      pulse *= Math.exp(-elapsed / 0.3);

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      const inset = (BLEED + settings.thickness / 2) * size.dpr;
      context.setTransform(size.dpr, 0, 0, size.dpr, inset, inset);
      context.globalCompositeOperation = 'lighter';
      context.lineCap = 'round';

      const headColor = toRgb(settings.color);
      const tailColor = toRgb(settings.trailColor);
      const brightness = 1 + (engaged && settings.hover === 'brighten' ? 0.5 : 0) + pulse * 0.5;
      const trail = Math.min(shape.total * settings.trailLength, shape.total / settings.stars / 1.15);

      for (let star = 0; star < settings.stars; star += 1) {
        const head = phase + (shape.total / settings.stars) * star;
        const steps = Math.min(100, Math.max(18, Math.ceil(trail / 3)));
        for (let step = steps; step > 0; step -= 1) {
          const progress = step / steps;
          const from = pointOnRoundedRect(width, height, settings.radius, head - trail * progress * settings.direction);
          const to = pointOnRoundedRect(width, height, settings.radius, head - trail * ((step - 1) / steps) * settings.direction);
          const intensity = (1 - progress) ** 1.7 * brightness;
          const tone = mix(tailColor, headColor, 1 - progress);
          context.strokeStyle = rgba(tone, intensity * 0.22 * settings.glow);
          context.lineWidth = settings.thickness + 7 * settings.glow;
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          context.stroke();
          context.strokeStyle = rgba(tone, intensity);
          context.lineWidth = settings.thickness;
          context.stroke();
        }

        if (settings.sparkle) {
          const point = pointOnRoundedRect(width, height, settings.radius, head);
          const bloom = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 18 + 28 * settings.glow);
          bloom.addColorStop(0, rgba(WHITE, 0.9));
          bloom.addColorStop(0.18, rgba(headColor, 0.55));
          bloom.addColorStop(1, rgba(headColor, 0));
          context.fillStyle = bloom;
          context.fillRect(point.x - 48, point.y - 48, 96, 96);
        }
      }

      frame = requestAnimationFrame(draw);
    };

    const wake = () => {
      if (!frame && visible) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    const onEnter = () => {
      engaged = true;
      wake();
    };
    const onLeave = () => {
      engaged = false;
    };
    const onFocusIn = () => {
      engaged = true;
      wake();
    };
    const onFocusOut = () => {
      engaged = false;
    };
    const onPointerDown = () => {
      if (settingsRef.current.clickPulse) pulse = 1;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) wake();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    resizeObserver.observe(root);
    visibilityObserver.observe(root);
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    resize();
    wake();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <Component
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      style={{
        '--star-border-radius': `${radius}px`,
        '--star-border-thickness': `${thickness}px`,
        '--star-border-surface': backgroundColor || palette.surface,
        '--star-border-text': textColor || palette.text,
        '--star-border-track': borderColor || palette.track,
        ...style,
      }}
      {...(Component === 'button' && rest.type === undefined
        ? { type: 'button' }
        : null)}
      {...rest}
    >
      <canvas ref={canvasRef} className={styles.light} aria-hidden="true" />
      {children}
    </Component>
  );
}
