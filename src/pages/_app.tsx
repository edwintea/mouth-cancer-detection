   // pages/_app.tsx
   import '../styles/style.css'; // Global CSS import
   import { AppProps } from 'next/app';

   function MyApp({ Component, pageProps }: AppProps) {
       return <Component {...pageProps} />;
   }

   export default MyApp;
   