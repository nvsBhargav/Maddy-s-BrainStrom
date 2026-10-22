import React from 'react';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', background: '#000' }}>
      <iframe 
        src="/index.html" 
        title="BrainVault v3.0 · Neural Spatial Knowledge & Cognitive OS"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
}
