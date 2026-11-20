import './globals.css';

const title = 'My English Reading Studio';
const description = '영어 원서를 읽고 AI 선생님과 해석·표현·발음을 연습하세요.';

export const metadata = {
  metadataBase: new URL('https://my-english-reading-studio.vercel.app'),
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'ko_KR',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }) {
  return <html lang="ko"><body>{children}</body></html>;
}
