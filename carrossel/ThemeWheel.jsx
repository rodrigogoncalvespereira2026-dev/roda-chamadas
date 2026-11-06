import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEMES } from "./themes";
import ThemeIcon from "./ThemeIcon";

/**
 * Roda de temas — porte do carrossel do cnbr.space.
 *
 * Geometria: os temas estão num cilindro de raio `--wheel-radius`. Cada opção
 * é girada pelo seu ângulo (`--option-angle`), empurrada para fora pelo raio e
 * virada 90° para ficar de perfil. O track inteiro gira com
 * `rotateY(--wheel-rotation)`; a opção da frente salta para 1.3× o raio e
 * recebe `--option-facing`, que a endireita de frente para a câmera.
 *
 * Interações: clique, arrasto com inércia, scroll do mouse e teclado.
 *
 * Este componente não depende de nada do projeto: recebe a lista de temas por
 * prop (ou usa THEMES), o id escolhido e o callback. As cores vêm do CSS de
 * ./roda.css. `label` é só o texto acessível do listbox.
 */

/** Pixels de arrasto até o clique virar gesto. */
const DRAG_THRESHOLD = 12;
/** Abaixo desta velocidade (graus/ms) a inércia acabou. */
const VELOCITY_EPSILON = 0.02;
/** Atrito da inércia: v *= e^(-FRICTION * dt). */
const FRICTION = 0.0013;
/** 60 px de arrasto = um item. */
const PIXELS_PER_STEP = 60;
/** Arrasto maior que isto (fração do ângulo) já troca de item ao soltar. */
const SNAP_RATIO = 4;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function wrapIndex(index, total) {
  if (!total) return 0;
  const rest = index % total;
  return rest < 0 ? rest + total : rest;
}

export default function ThemeWheel({
  themes = THEMES,
  selectedTheme,
  onSelect,
  onActivate,
  label = "Temas",
}) {
  const total = themes.length;
  const angle = total ? 360 / total : 0;

  const containerRef = useRef(null);
  const rotationRef = useRef(0);
  const dragRef = useRef(null);
  const velocityRef = useRef(0);
  const lastFrameRef = useRef(null);
  const animationRef = useRef(null);
  /** Um clique logo depois de um arrasto é o fim do gesto, não uma escolha. */
  const suppressClickRef = useRef(false);

  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [width, setWidth] = useState(0);

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    velocityRef.current = 0;
    setIsDragging(false);
  }, []);

  useEffect(() => stopAnimation, [stopAnimation]);

  /* ----- medidas: o raio e o tamanho saem da largura do container ----- */

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => {
      const next = node.getBoundingClientRect().width;
      setWidth((current) => (current === next ? current : next));
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ----- rotação ----- */

  /** Rotação que põe `index` na frente, girando pelo caminho mais curto. */
  const rotationFor = useCallback(
    (index, direction) => {
      if (!total || !angle) return 0;

      const target = -wrapIndex(index, total) * angle;
      const current = rotationRef.current;

      let delta = (((target - current) % 360) + 360) % 360;
      if (delta > 180) delta -= 360;

      // Com direção forçada, mantém o giro no sentido do gesto.
      if (direction === 1) {
        const alternate = delta - 360;
        if (Math.abs(alternate) < Math.abs(delta)) delta = alternate;
      } else if (direction === -1) {
        const alternate = delta + 360;
        if (Math.abs(alternate) < Math.abs(delta)) delta = alternate;
      }

      return current + delta;
    },
    [angle, total]
  );

  const activeIndex = useMemo(
    () => (total && angle ? wrapIndex(Math.round(-rotation / angle), total) : 0),
    [angle, rotation, total]
  );

  const goTo = useCallback(
    (index, direction) => {
      if (!total || !angle) return 0;

      const next = wrapIndex(index, total);
      const value = rotationFor(next, direction);

      rotationRef.current = value;
      startTransition(() => setRotation(value));
      return next;
    },
    [angle, rotationFor, total]
  );

  const step = useCallback(
    (direction) => {
      if (!total || !angle) return 0;
      const current = Math.round(-rotationRef.current / angle);
      return goTo(current + direction, direction);
    },
    [angle, goTo, total]
  );

  /** Solta a roda: aplica inércia ou encaixa no item mais próximo. */
  const settle = useCallback(
    (velocity) => {
      if (!angle) {
        step();
        return;
      }

      let speed = velocity;

      if (Math.abs(speed) < VELOCITY_EPSILON) {
        step(speed < 0 ? 1 : speed > 0 ? -1 : undefined);
        return;
      }

      stopAnimation();
      velocityRef.current = speed;
      setIsDragging(true);

      let last = 0;

      const frame = (now) => {
        const delta = now - last;
        last = now;
        speed = velocityRef.current;

        if (delta > 0) {
          const decayed = speed * Math.exp(-FRICTION * delta);
          const travelled = ((speed + decayed) / 2) * delta;
          const value = rotationRef.current + travelled;

          rotationRef.current = value;
          setRotation(value);
          velocityRef.current = decayed;
          speed = decayed;
        }

        if (Math.abs(speed) < VELOCITY_EPSILON) {
          const direction = speed < 0 ? 1 : speed > 0 ? -1 : undefined;
          stopAnimation();
          step(direction);
          return;
        }

        animationRef.current = requestAnimationFrame(frame);
      };

      animationRef.current = requestAnimationFrame((now) => {
        last = now;
        frame(now);
      });
    },
    [angle, step, stopAnimation]
  );

  /* ----- arrasto ----- */

  const handlePointerDown = useCallback(
    (event) => {
      if (total < 2) return;

      stopAnimation();
      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startRotation: rotationRef.current,
        lastRotation: rotationRef.current,
        hasDragged: false,
      };
      lastFrameRef.current = null;
    },
    [stopAnimation, total]
  );

  const handlePointerMove = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const travelled = event.clientX - drag.startX;
      const now = performance.now();

      if (!drag.hasDragged) {
        if (Math.abs(travelled) < DRAG_THRESHOLD) return;
        drag.hasDragged = true;
        setIsDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
        lastFrameRef.current = now;
      }

      if (!angle) return;

      const step = angle / PIXELS_PER_STEP;
      const value = drag.startRotation + travelled * step;
      const previous = drag.lastRotation;

      rotationRef.current = value;
      setRotation(value);

      if (lastFrameRef.current !== null) {
        const delta = now - lastFrameRef.current;
        if (delta > 0) velocityRef.current = (value - previous) / delta;
      }

      lastFrameRef.current = now;
      drag.lastRotation = value;
      event.preventDefault();
    },
    [angle]
  );

  const handlePointerUp = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (drag.hasDragged) {
        suppressClickRef.current = true;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        setIsDragging(false);

        const travelled = drag.lastRotation - drag.startRotation;
        const velocity = velocityRef.current;

        if (Math.abs(velocity) > VELOCITY_EPSILON) {
          settle(velocity);
        } else {
          let direction;
          if (Math.abs(travelled) > angle / SNAP_RATIO) {
            direction = travelled < 0 ? 1 : -1;
          }
          step(direction);
          velocityRef.current = 0;
        }
      }

      dragRef.current = null;
      lastFrameRef.current = null;
    },
    [angle, settle, step]
  );

  /* ----- scroll e teclado ----- */

  const handleWheel = useCallback(
    (event) => {
      if (total < 2) return;

      const raw =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(raw) < 5) return;

      const direction = raw > 0 ? 1 : -1;
      goTo(activeIndex + direction, direction);
    },
    [activeIndex, goTo, total]
  );

  const wheelHandlerRef = useRef(handleWheel);
  useEffect(() => {
    wheelHandlerRef.current = handleWheel;
  }, [handleWheel]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // preventDefault sempre: o scroll do mouse gira a roda, não a página.
    const listener = (event) => {
      event.preventDefault();
      wheelHandlerRef.current(event);
    };

    node.addEventListener("wheel", listener, { passive: false });
    return () => node.removeEventListener("wheel", listener);
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (!total) return;

      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          goTo(activeIndex + 1, 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          goTo(activeIndex - 1, -1);
          break;
        case "Home":
          event.preventDefault();
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(total - 1);
          break;
        case "Enter":
        case " ": {
          event.preventDefault();
          const theme = themes[activeIndex];
          if (!theme) break;
          if (onActivate) onActivate(theme);
          else onSelect?.(theme);
          break;
        }
        default:
          break;
      }
    },
    [activeIndex, goTo, onActivate, onSelect, themes, total]
  );

  const handleSelect = useCallback(
    (index) => {
      if (!total) return;

      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }

      const next = goTo(index);
      const theme = themes[next];
      if (!theme) return;

      // Clicar no item da frente ativa de verdade (chamar); nos outros, só gira.
      if (theme.id === selectedTheme) onActivate?.(theme);
      else onSelect?.(theme);
    },
    [goTo, onActivate, onSelect, selectedTheme, themes, total]
  );

  /* ----- o tema escolhido manda na rotação ----- */

  useEffect(() => {
    if (!total || !angle) return;

    const index = themes.findIndex((theme) => theme.id === selectedTheme);
    if (index < 0) return;

    const value = rotationFor(index);
    rotationRef.current = value;
    startTransition(() => setRotation(value));
  }, [angle, rotationFor, selectedTheme, themes, total]);

  /* ----- medidas viram custom properties ----- */

  const style = useMemo(() => {
    const measured = width > 0 ? width : 420;
    const radius = clamp(measured * 0.38, 110, 160);
    const itemSize = clamp(measured * 0.24, 60, 88);
    const height = clamp(radius * 1.45, 140, 240);

    return {
      "--wheel-radius": `${radius}px`,
      "--wheel-height": `${height}px`,
      "--wheel-item-size": `${itemSize}px`,
      "--wheel-angle": `${angle}deg`,
      "--wheel-rotation": `${rotation}deg`,
    };
  }, [angle, rotation, width]);

  return (
    <div
      ref={containerRef}
      className={`theme-wheel${isDragging ? " is-dragging" : ""}`}
      style={style}
      role="listbox"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label={label}
      aria-activedescendant={total ? themes[activeIndex]?.id : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="theme-wheel__track">
        {themes.map((theme, index) => {
          const optionAngle = angle * index;

          let facing = (-(rotation + optionAngle) % 360 + 360) % 360;
          if (facing > 180) facing -= 360;

          const isActive = index === activeIndex;
          const isSelected = theme.id === selectedTheme;

          const className = [
            "theme-wheel__option",
            isActive ? "is-active" : "",
            isSelected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={theme.id}
              type="button"
              id={theme.id}
              className={className}
              style={{
                "--option-angle": `${optionAngle}deg`,
                "--option-facing": `${facing}deg`,
                // cada opção carrega o acento do seu próprio tema (como as regras
                // #cat/#ladybug do site) — o roda.css deriva a rampa daqui
                "--accent-base": theme.accent,
              }}
              role="option"
              aria-selected={isSelected}
              aria-label={`${theme.name} · ${label}`}
              title={theme.name}
              onClick={() => handleSelect(index)}
            >
              <ThemeIcon id={theme.id} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
