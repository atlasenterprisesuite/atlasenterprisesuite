import './health.css';
import { AppRouter } from './app/router/AppRouter';
import { AtlasProvider } from './app/providers/AtlasContext';

export function App() {
  return <AtlasProvider><AppRouter /></AtlasProvider>;
}
