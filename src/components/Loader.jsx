import React from 'react';
import '../css/loader.css';

export default function Loader({ className = '' }) {
  return <div className={`loader ${className}`} />;
}
