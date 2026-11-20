import { ImageResponse } from 'next/og';

export const alt = 'My English Reading Studio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      display: 'flex', width: '100%', height: '100%', padding: 42,
      background: '#f3f4ff',
    }}>
      <div style={{
        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 65px', borderRadius: 48, background: '#303ec5', color: '#fff',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 25, letterSpacing: 5, color: '#dff68b' }}>MY ENGLISH</div>
          <div style={{ fontSize: 81, fontWeight: 700, lineHeight: 1, marginTop: 18 }}>Reading</div>
          <div style={{ fontSize: 81, fontWeight: 700, lineHeight: 1 }}>Studio</div>
          <div style={{ fontSize: 26, color: '#ebedff', marginTop: 28 }}>Read, translate, and speak.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 246, height: 246, borderRadius: 48, background: '#dff68b',
            color: '#283399', fontSize: 165, fontWeight: 700,
          }}>E</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', width: 90, height: 116, borderRadius: 24, background: '#b5baff' }}/>
            <div style={{ display: 'flex', width: 90, height: 116, borderRadius: 24, background: '#fff' }}/>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
