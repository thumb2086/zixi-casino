import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import i18n from './i18n'

// set initial html lang for SEO
document.documentElement.lang = i18n.language.startsWith('zh') ? 'zh-Hant' : 'en';
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.startsWith('zh') ? 'zh-Hant' : 'en';
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
