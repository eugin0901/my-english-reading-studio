import { ImageResponse } from 'next/og';

export const alt = 'My English Reading Studio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function IconTile({ background, size, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 24, background,
    }}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
        stroke="#283399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      display: 'flex', width: '100%', height: '100%', padding: 32, background: '#eef2ff',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        width: '100%', padding: '54px 72px', borderRadius: 44, color: '#fff',
        backgroundImage: 'linear-gradient(112deg, #2549e9 0%, #365df0 58%, #6589ff 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <IconTile background="#dff68b" size={72}>
            <path d="M12 7v14m0-14c-2-2-4-3-9-3v14c5 0 7 1 9 3 2-2 4-3 9-3V4c-5 0-7 1-9 3Z"/>
          </IconTile>
          <div style={{ fontSize: 29, fontWeight: 700 }}>ReadingStudio</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.04 }}>My English</div>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.04 }}>Reading Studio</div>
          <div style={{ fontSize: 29, color: '#ebedff', marginTop: 18 }}>Read. Learn. Review. Grow.</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <IconTile background="#dff68b" size={88}>
            <path d="M12 7v14m0-14c-2-2-4-3-9-3v14c5 0 7 1 9 3 2-2 4-3 9-3V4c-5 0-7 1-9 3Z"/>
          </IconTile>
          <IconTile background="#b5baff" size={88}>
            <path d="M3 14v-2a9 9 0 0 1 18 0v2"/>
            <rect x="3" y="13" width="5" height="7" rx="2"/>
            <rect x="16" y="13" width="5" height="7" rx="2"/>
          </IconTile>
          <IconTile background="#fff" size={88}>
            <path d="M12 20h9M16 4l4 4M3 21l4-1 14-14-4-4L3 16l-1 5z"/>
          </IconTile>
        </div>
      </div>
    </div>,
    size,
  );
}
