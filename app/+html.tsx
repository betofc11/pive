import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { Theme } from '../src/theme';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this file only run in Node.js, so you cannot
// import CSS or use any client-side logic here.

// The app is always dark: paint the page itself dark too, so the area behind the iOS status bar,
// the overscroll bounce and anything outside the React root never show the browser's white default.
const darkPageStyle = `
html, body {
  background-color: ${Theme.colors.background};
  color-scheme: dark;
}`;

export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/*
          No viewport-fit=cover on purpose: in the iOS home-screen app it moves the page under the
          status bar without growing its height (leaving a gap at the bottom), and iOS blurs whatever
          sits under the status bar. Without it the page starts below the status bar, whose
          background is the dark html/body.
        */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Tell the browser the page is dark even when the device is in light mode */}
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content={Theme.colors.background} />

        {/* iOS Meta Tags for Native PWA App */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pive" />

        {/* iOS Icon */}
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/*
          Disables the default styling of ScrollView to ensure native parity.
          This is recommended for full-screen React Native web apps.
        */}
        <ScrollViewStyleReset />
        <style id="pive-dark-page" dangerouslySetInnerHTML={{ __html: darkPageStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
