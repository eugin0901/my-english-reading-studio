import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'My English Reading Studio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const mark = await readFile(join(process.cwd(), 'app', 'share-mark.png'));
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
        <img
          src={'data:image/png;base64,' + mark.toString('base64')}
          alt=""
          width={348}
          height={348}
        />
      </div>
    </div>,
    size,
  );
}
