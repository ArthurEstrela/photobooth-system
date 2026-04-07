// frontend/src/components/CircularTimer.tsx
import React, { useEffect, useState } from 'react';

interface CircularTimerProps {
  expiresAt: string;
  totalSeconds: number;
}

export const CircularTimer: React.FC<CircularTimerProps> = ({ expiresAt, totalSeconds }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const expirationTime = new Date(expiresAt).getTime();

    const tick = () => {
      const distance = expirationTime - Date.now();
      if (distance <= 0) {
        setSecondsLeft(0);
        return;
      }
      setSecondsLeft(Math.ceil(distance / 1000));
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);
  const isUrgent = secondsLeft <= 30;
  const strokeColor = isUrgent ? '#ef4444' : '#111827'; // red-500 : gray-900

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className={`relative inline-flex items-center justify-center ${isUrgent ? 'animate-pulse' : ''}`}>
      <svg width="128" height="128" viewBox="0 0 128 128">
        {/* Trilha cinza */}
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        {/* Arco de progresso */}
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute text-2xl font-bold tabular-nums"
        style={{ color: strokeColor }}
      >
        {timeDisplay}
      </span>
    </div>
  );
};
