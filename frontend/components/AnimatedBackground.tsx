'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  size: number;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create particles
    const particles: Particle[] = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 1000,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
      });
    }

    // Grid settings
    const gridSize = 100;
    let gridRotation = 0;

    // Animation loop
    const animate = () => {
      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw perspective grid
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // Rotate grid slightly
      gridRotation += 0.001;

      // Draw horizontal grid lines (perspective effect)
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.lineWidth = 1;

      for (let i = -10; i <= 10; i++) {
        const y = i * gridSize;
        const perspective = 1 - Math.abs(y) / (canvas.height / 2);
        const alpha = perspective * 0.15;

        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(-canvas.width / 2, y);
        ctx.lineTo(canvas.width / 2, y);
        ctx.stroke();
      }

      // Draw vertical grid lines
      for (let i = -15; i <= 15; i++) {
        const x = i * gridSize;
        const perspective = 1 - Math.abs(x) / (canvas.width / 2);
        const alpha = perspective * 0.15;

        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, -canvas.height / 2);
        ctx.lineTo(x, canvas.height / 2);
        ctx.stroke();
      }

      // Draw diagonal lines for parametric dome effect
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.06)';
      const numDiagonals = 16;
      for (let i = 0; i < numDiagonals; i++) {
        const angle = (i / numDiagonals) * Math.PI * 2 + gridRotation;
        const radius = Math.max(canvas.width, canvas.height);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius
        );
        ctx.stroke();
      }

      // Draw concentric circles for dome structure
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.08)';
      for (let i = 1; i <= 5; i++) {
        const radius = i * 150;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Draw and update particles
      particles.forEach((p) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle with glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, 'rgba(96, 165, 250, 0.6)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connection lines between nearby particles
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.lineWidth = 1;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            const alpha = (1 - distance / 150) * 0.2;
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10"
        style={{ background: 'linear-gradient(180deg, #000000 0%, #0a0a1a 50%, #000510 100%)' }}
      />
      {/* Atmospheric lighting overlay */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-to-b from-purple-900/10 via-transparent to-blue-900/10" />
    </>
  );
}
