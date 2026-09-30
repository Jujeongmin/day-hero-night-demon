import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles.css';

import { prepareConnection } from './services/localMode';
import { applyLang, detectLang, savedLang } from './strings/i18n';

// 고른 언어(없으면 기기 언어)로 사전을 먼저 바꾼다. 처음이면 로딩 뒤 언어 고르는 화면이 뜬다
applyLang(savedLang() ?? detectLang());

// 로컬 서버 모드(?local=1, 개발 전용)면 서버 코드를 먼저 불러온 뒤 그린다
void prepareConnection().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
