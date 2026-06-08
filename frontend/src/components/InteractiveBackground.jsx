import React, { useRef, useEffect } from 'react';

/**
 * InteractiveBackground
 * A high-quality, performant, theme-appropriate interactive background.
 * Features:
 * - Subtle tech grid that reacts to mouse
 * - Rising ember/heat particles (fire safety theme)
 * - Mouse attraction on particles (subtle "heat" pull)
 * - Very low opacity so it never fights content
 * - Fully responsive and performant
 */
const InteractiveBackground = ({
  className = '',
  particleCount = 110,
  intensity = 0.85, // 0.5 - 1.2 recommended
  color = '#ff4d1c', // primary brand orange
  secondaryColor = '#f59e0b', // warm accent
  showGrid = true,
  showParticles = true,
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let width = 0;
    let height = 0;
    let time = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    window.addEventListener('resize', resize);

    // Initialize particles (embers)
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height * 1.2,
          vx: (Math.random() - 0.5) * 0.18,
          vy: -0.35 - Math.random() * 0.55, // rising
          size: 0.8 + Math.random() * 1.9,
          alpha: 0.35 + Math.random() * 0.55,
          life: Math.random() * 100,
          hueOffset: Math.random() * 20 - 10,
        });
      }
    };

    initParticles();

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Main animation loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      time += 0.016;

      const mouse = mouseRef.current;

      // === Subtle Interactive Grid ===
      if (showGrid) {
        ctx.strokeStyle = `rgba(255,255,255,${0.035 * intensity})`;
        ctx.lineWidth = 1;

        const gridSize = 52;
        const offsetX = ((time * 6) % gridSize);
        const offsetY = ((time * 3) % gridSize);

        // Vertical lines
        for (let x = -gridSize; x < width + gridSize; x += gridSize) {
          const lineX = x + offsetX;
          ctx.beginPath();
          ctx.moveTo(lineX, 0);
          ctx.lineTo(lineX, height);
          ctx.stroke();
        }

        // Horizontal lines
        for (let y = -gridSize; y < height + gridSize; y += gridSize) {
          const lineY = y + offsetY;
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(width, lineY);
          ctx.stroke();
        }

        // Mouse-reactive grid highlight
        if (mouse.active) {
          ctx.strokeStyle = `rgba(255, 77, 28, ${0.06 * intensity})`;
          ctx.lineWidth = 1.5;

          const mx = Math.floor(mouse.x / gridSize) * gridSize;
          const my = Math.floor(mouse.y / gridSize) * gridSize;

          ctx.beginPath();
          ctx.rect(mx - gridSize * 1.5, my - gridSize * 1.5, gridSize * 3, gridSize * 3);
          ctx.stroke();
        }
      }

      // === Ember / Heat Particles ===
      if (showParticles) {
        const particles = particlesRef.current;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Mouse attraction (subtle heat pull toward cursor)
          if (mouse.active) {
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

            if (dist < 280) {
              const force = (280 - dist) / 280 * 0.028 * intensity;
              p.vx += (dx / dist) * force;
              p.vy += (dy / dist) * force * 0.6;
            }
          }

          // Update position
          p.x += p.vx;
          p.y += p.vy;

          // Gentle horizontal drift
          p.vx += Math.sin(time * 1.3 + i) * 0.004;
          p.vx *= 0.985; // friction

          // Respawn when off top
          if (p.y < -20) {
            p.y = height + 30 + Math.random() * 40;
            p.x = Math.random() * width;
            p.vy = -0.35 - Math.random() * 0.55;
            p.alpha = 0.35 + Math.random() * 0.55;
          }

          // Slow fade in/out for life
          p.life += 0.8;
          const fade = Math.sin(p.life * 0.035) * 0.5 + 0.5;
          const currentAlpha = p.alpha * fade * intensity;

          // Draw ember
          ctx.save();
          ctx.globalAlpha = Math.max(0.1, currentAlpha);

          // Core
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
          ctx.fill();

          // Soft outer glow
          ctx.fillStyle = secondaryColor;
          ctx.globalAlpha = currentAlpha * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.85, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      // Very subtle warm vignette at bottom for depth
      const grad = ctx.createLinearGradient(0, height * 0.65, 0, height);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, `rgba(10, 12, 15, ${0.55 * intensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [particleCount, intensity, color, secondaryColor, showGrid, showParticles]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    />
  );
};

export default InteractiveBackground;
