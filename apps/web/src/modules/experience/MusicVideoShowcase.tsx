import { Link } from 'react-router-dom';
import './music-video-showcase.css';

export function MusicVideoShowcase() {
  return (
    <section className="atlas-mv-showcase" aria-label="Music & Video Studio preview">
      <header className="atlas-mv-showcase-head">
        <div>
          <p className="eyebrow">ATLAS Music & Video</p>
          <h2>Music. Camera. Script. One Studio.</h2>
        </div>
        <p>One creative entry point for music, video production and the Smart Teleprompter. Each opens its existing governed workspace.</p>
      </header>
      <figure className="atlas-mv-visual">
        <img
          src="/atlas/design/atlas-music-video-studio.svg"
          alt="ATLAS Music & Video visual with a music player and lyrics, video camera and smart teleprompter on two phone screens"
          width="1600"
          height="900"
          loading="lazy"
          decoding="async"
        />
      </figure>
      <nav className="atlas-mv-actions" aria-label="Music & Video Studio tools">
        <Link to="/studio/create?type=music">Open Music Lab</Link>
        <Link to="/studio/create?type=video">Open Video Studio</Link>
        <Link to="/studio/teleprompter">Open Smart Teleprompter</Link>
      </nav>
      <p className="atlas-mv-note">Visual concept only. Music/video generation depends on verified providers; camera recording and private storage keep their existing authorization and browser permission checks.</p>
    </section>
  );
}
