// src/components/Switch.jsx
import React from 'react';
import '../css/Switch.css';

export default function Switch({
  label,
  value = '',      // incoming string: empty = off, non‐empty = on
  onChange,
  disabled = false,
  width = '15',
}) {
  const isOn = Boolean(value);

  const handleClick = () => {
    if (disabled) return;
    // toggle between '' and 'YES'
    onChange?.(isOn ? '' : 'YES');
  };
  //take width from props
  return (
    <div className={`switch-wrapper ${disabled ? 'disabled' : ''}`}style={{ width: `${width}rem` }}>
      <span className="switch-label">{label}</span>
      <div
        className={`switch${isOn ? ' on' : ''}`}
        onClick={handleClick}
      >
        <div className="switch-thumb" />
      </div>
    </div>
  );
}
