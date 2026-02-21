import type { Metadata } from "next";
import { Inter, Cinzel, Permanent_Marker } from "next/font/google";
import { Providers } from "./providers";
import { AdSenseScript } from "@/components/ads";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  variable: "--font-marker",
  display: "swap",
  weight: "400",
});

// Dominio de producción - cambiar según el entorno
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trucouruguayo.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Truco Uruguayo Online Gratis - Juga con Amigos",
    template: "%s | Truco Uruguayo Online",
  },
  description:
    "Juga al Truco Uruguayo online gratis. Partidas 1v1, 2v2, 3v3 en tiempo real. Envido, Truco, Flor. 100% gratis.",
  keywords: [
    "truco uruguayo",
    "truco uruguayo online",
    "jugar truco uruguayo",
    "truco uruguayo gratis",
    "truco online",
    "juego de truco",
    "truco cartas",
    "truco multijugador",
    "truco con amigos",
    "truco uruguay",
    "cartas uruguayas",
    "juego de cartas uruguayo",
    "truco en linea",
    "truco gratis",
    "envido",
    "flor truco",
    "truco retruco vale cuatro",
    "juegos uruguayos",
    "cartas espanolas",
    "truco argentino uruguayo",
    "mejor juego de truco",
    "truco tiempo real",
  ],
  authors: [{ name: "Enzo Pontet", url: "mailto:enzopch2022@gmail.com" }],
  creator: "Enzo Pontet",
  publisher: "Truco Uruguayo Online",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_UY",
    url: SITE_URL,
    siteName: "Truco Uruguayo Online",
    title: "Truco Uruguayo Online Gratis - Juga con Amigos",
    description:
      "El autentico Truco Uruguayo online. Juga gratis con amigos en tiempo real. Modos 1v1, 2v2 y 3v3.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Truco Uruguayo Online - Juego de cartas tradicional uruguayo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Truco Uruguayo Online Gratis - Juga con Amigos",
    description:
      "El autentico Truco Uruguayo online. Juga gratis con amigos en tiempo real.",
    images: ["/og-image.png"],
    creator: "@trucouruguayo",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      es: SITE_URL,
      "x-default": SITE_URL,
    },
  },
  category: "games",
  classification: "Card Games",
  verification: {
    google: "tu-codigo-de-verificacion-google",
  },
  other: {
    "apple-mobile-web-app-title": "Truco Uruguayo",
    "application-name": "Truco Uruguayo Online",
    "msapplication-TileColor": "#1a5276",
    "theme-color": "#1a5276",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: "Truco Uruguayo Online",
      description:
        "El autentico Truco Uruguayo online. Juga gratis con amigos en tiempo real. Modos 1v1, 2v2 y 3v3.",
      url: SITE_URL,
      applicationCategory: "GameApplication",
      operatingSystem: "Web Browser",
      browserRequirements: "Requires JavaScript",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "150",
        bestRating: "5",
        worstRating: "1",
      },
      author: {
        "@type": "Person",
        name: "Enzo Pontet",
        email: "enzopch2022@gmail.com",
      },
      inLanguage: "es",
      isAccessibleForFree: true,
    },
    {
      "@type": "Game",
      "@id": `${SITE_URL}/#game`,
      name: "Truco Uruguayo",
      alternateName: ["Truco", "Truco Online", "Truco Uruguay", "Truco Cartas"],
      description:
        "Juego de cartas tradicional uruguayo. Juga al Truco con tus amigos online en tiempo real. Incluye Envido, Truco, Retruco, Vale Cuatro, Flor y todas las reglas del truco uruguayo autentico.",
      url: SITE_URL,
      genre: ["Card Game", "Multiplayer", "Traditional Game"],
      numberOfPlayers: {
        "@type": "QuantitativeValue",
        minValue: 2,
        maxValue: 6,
      },
      gameLocation: {
        "@type": "Place",
        name: "Online",
      },
      author: {
        "@type": "Person",
        name: "Enzo Pontet",
      },
      countryOfOrigin: {
        "@type": "Country",
        name: "Uruguay",
      },
      inLanguage: "es",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Truco Uruguayo Online",
      description:
        "La mejor plataforma para jugar al Truco Uruguayo online gratis",
      publisher: {
        "@type": "Person",
        name: "Enzo Pontet",
      },
      inLanguage: "es",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/lobby?search={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Truco Uruguayo Online",
      url: SITE_URL,
      logo: `${SITE_URL}/Images/SolDeMayo.png`,
      contactPoint: {
        "@type": "ContactPoint",
        email: "enzopch2022@gmail.com",
        contactType: "customer support",
        availableLanguage: "Spanish",
      },
      founder: {
        "@type": "Person",
        name: "Enzo Pontet",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Como jugar al Truco Uruguayo online?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Es muy facil! Solo ingresa a trucouruguayo.onrender.com, crea una partida o unite a una existente, e invita a tus amigos. Podes jugar 1v1, 2v2 o 3v3 completamente gratis.",
          },
        },
        {
          "@type": "Question",
          name: "El Truco Uruguayo es gratis?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Si, Truco Uruguayo Online es 100% gratis. Podes jugar todas las partidas que quieras sin ningun costo.",
          },
        },
        {
          "@type": "Question",
          name: "Cuantos jugadores pueden jugar al Truco?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "El Truco Uruguayo se juega de 2 a 6 jugadores. Podes jugar 1v1 (mano a mano), 2v2 (equipos de dos) o 3v3 (equipos de tres).",
          },
        },
        {
          "@type": "Question",
          name: "Cuales son las reglas del Truco Uruguayo?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "El Truco Uruguayo usa un mazo espanol de 40 cartas. Se juega al mejor de 3 manos por ronda, y el juego es a 30 puntos. Incluye cantos como Envido, Truco, Retruco, Vale Cuatro y Flor.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${cinzel.variable} ${permanentMarker.variable}`}
    >
      <head>
        <AdSenseScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} bg-table-wood`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
