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
}
#pive-top-edge {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 12px;
  background-color: ${Theme.colors.background};
  z-index: 1;
}
@media (display-mode: standalone) {
  #pive-top-edge { display: block; }
}
html[data-standalone] #pive-top-edge {
  display: block;
}`;

// iOS sets navigator.standalone in home-screen apps; a fallback in case it doesn't match the
// display-mode media query (the app has no web manifest)
const standaloneScript = `if (navigator.standalone) document.documentElement.setAttribute('data-standalone', '');`;

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
        <script dangerouslySetInnerHTML={{ __html: standaloneScript }} />
      </head>
      <body>
        {/*
          iOS 26 home-screen apps blur the top ~40pt of the page (the system "scroll edge effect"),
          dimming the header. WebKit skips it when a fixed, full-width, solid-colour box taller than
          10px sits at the top edge, so this one does, only in the installed app. It covers the
          top 12px of padding every screen leaves empty, under the app's modals (z-index 1).
        */}
        <div id="pive-top-edge" />
        {children}
      </body>
    </html>
  );
}
