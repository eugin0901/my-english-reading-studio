import { ImageResponse } from 'next/og';

export const alt = 'My English Reading Studio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      display: 'flex', width: '100%', height: '100%', padding: 54,
      background: '#dbf1e8', color: '#153a33',
    }}>
      <div style={{
        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 64px', borderRadius: 32, background: '#f9fffc', border: '2px solid #b9decf',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 22, letterSpacing: 5, color: '#17775f' }}>MY ENGLISH</div>
          <div style={{ fontSize: 82, fontWeight: 700, lineHeight: 1.02, marginTop: 18 }}>Reading</div>
          <div style={{ fontSize: 82, fontWeight: 700, lineHeight: 1.02 }}>Studio</div>
          <div style={{ fontSize: 24, color: '#456259', marginTop: 28 }}>Read, translate, and speak.</div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: 348, height: 348, borderRadius: 174, background: '#d9f0e6',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 24 }}>
            <div style={{
              display: 'flex', width: 106, height: 100, borderRadius: '14px 28px 8px 14px',
              border: '5px solid #117967', background: '#fff', transform: 'skewY(9deg)',
            }}/>
            <div style={{
              display: 'flex', width: 106, height: 100, borderRadius: '28px 14px 14px 8px',
              border: '5px solid #117967', background: '#fff', transform: 'skewY(-9deg)',
            }}/>
          </div>
          <div style={{ display: 'flex', width: 221, height: 24, borderRadius: 9, background: '#55a590', marginBottom: 7 }}/>
          <div style={{ display: 'flex', width: 257, height: 28, borderRadius: 10, background: '#147d67' }}/>
        </div>
      </div>
    </div>,
    size,
  );
}
