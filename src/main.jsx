import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Ogohlantirish: Socket rejimida VITE_API_URL kerak
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const apiUrl = (import.meta.env.VITE_API_URL || '').trim();
if (!supabaseUrl && !apiUrl) {
  console.warn('Kinofan: Socket rejimi uchun VITE_API_URL kerak. Supabase ishlatmasangiz, .env da VITE_API_URL ni o‘rnating.');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
