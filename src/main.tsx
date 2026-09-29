import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles.css';

import { prepareConnection } from './services/connection';

// 로컬 서버 모드(?local=1, 개발 전용)면 서버 코드를 먼저 불러온 뒤 그린다
void prepareConnection().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
