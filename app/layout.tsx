import './globals.css';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Threads Lab — 콘텐츠 연구소',description:'내 Threads 분석, 주제 추천, AI 글 작성, 로컬 예약 발행'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="ko"><body>{children}</body></html>}
