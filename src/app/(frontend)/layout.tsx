import React from "react";
import "./styles.css";
import Providers from "@/components/Providers";
import Footer from "@/components/Footer";
import { getGlobalProps } from "@/lib/data";
import api from "@/lib/payload/index";
import { headers } from "next/headers";

export const metadata = {
  description: "A blank template using Payload in a Next.js app.",
  title: "Payload Blank Template",
};

function extractTenantFromHost(host: string): string | null {
  const subdomain = host.split(".")[0];
  return subdomain !== "www" && subdomain !== "localhost" ? subdomain : null;
}

type LayoutProps = {
  children: React.ReactNode;
  params?: {
    locale?: string;
    tenant?: string;
  };
};

export default async function RootLayout(props: LayoutProps) {
  const { children, params } = props;

  const locale = params?.locale || "en";
  const tenant = params?.tenant;

  const headersList = await headers();
  const host = headersList.get("host") || "";

  const globalProps = await getGlobalProps(api, {
    locale,
    tenant: tenant || extractTenantFromHost(host),
  });

  return (
    <html lang="en">
      <body>
        <Providers>
          <main>
            {children}
            <Footer
              about={globalProps?.siteSettings?.about || {}}
              copyright={
                globalProps?.siteSettings?.copyright || {
                  src: `data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='19.258' height='19.275' viewBox='0 0 19.258 19.275'%3e%3cdefs%3e%3cstyle%3e.a%7bfill:%23909090;%7d%3c/style%3e%3c/defs%3e%3cg transform='translate(0 0)'%3e%3cpath class='a' d='M293.551,20.089a9.841,9.841,0,0,1-.87,4.082,9.138,9.138,0,0,1-2.3,3.07,9.915,9.915,0,0,1-3.385,1.976,9.491,9.491,0,0,1-2.31.479,9.381,9.381,0,0,1-4.2-.607,9.844,9.844,0,0,1-5.851-6.441,9.325,9.325,0,0,1-.322-3.121,9.649,9.649,0,0,1,3.073-6.508,9.016,9.016,0,0,1,3.677-2.155,9.4,9.4,0,0,1,2.043-.379,9.965,9.965,0,0,1,3.855.441,9.585,9.585,0,0,1,6.046,5.911,9.478,9.478,0,0,1,.5,2.412C293.527,19.528,293.536,19.809,293.551,20.089Zm-1.75.01a8.132,8.132,0,0,0-.333-2.334,7.86,7.86,0,0,0-5.019-5.17,8.021,8.021,0,0,0-3.745-.31,7.346,7.346,0,0,0-3.035,1.15,8.013,8.013,0,0,0-2.474,2.586,7.579,7.579,0,0,0-.921,5.937,8.026,8.026,0,0,0,6.561,5.923,7.851,7.851,0,0,0,5.72-1.43,7.7,7.7,0,0,0,2.386-2.7A7.841,7.841,0,0,0,291.8,20.1Z' transform='translate(-274.293 -10.453)'/%3e%3cpath class='a' d='M315.94,36.694l-1.278.672-.05-.092a1.206,1.206,0,0,0-.834-.663,1.107,1.107,0,0,0-1.292.666A2.574,2.574,0,0,0,312.5,39.3a1.23,1.23,0,0,0,1.842.486,1.362,1.362,0,0,0,.4-.53l.039-.081,1.192.607a2.919,2.919,0,0,1-.553.713,3.06,3.06,0,0,1-3.659.331,2.494,2.494,0,0,1-1.058-1.511,3.6,3.6,0,0,1,.13-2.367,2.556,2.556,0,0,1,2.069-1.6,3.2,3.2,0,0,1,1.922.26A2.492,2.492,0,0,1,315.94,36.694Z' transform='translate(-300.866 -28.658)'/%3e%3cpath class='a' d='M293.98,39.172l1.193.608a2.972,2.972,0,0,1-.736.873,3.078,3.078,0,0,1-3.45.188,2.493,2.493,0,0,1-1.081-1.513,3.631,3.631,0,0,1,.077-2.255,2.564,2.564,0,0,1,2.129-1.724,3.183,3.183,0,0,1,1.936.273,2.478,2.478,0,0,1,1.09,1.076l-1.273.669c-.018-.032-.035-.061-.052-.09a1.2,1.2,0,0,0-.842-.664,1.127,1.127,0,0,0-1.289.665,2.537,2.537,0,0,0-.179,1.046,2.334,2.334,0,0,0,.177.949,1.174,1.174,0,0,0,1.314.722,1.142,1.142,0,0,0,.941-.725Z' transform='translate(-285.628 -28.659)'/%3e%3c/g%3e%3c/svg%3e`,
                }
              }
              legalLinks={
                globalProps?.siteSettings?.legalLinks || [
                  {
                    label: "2024 PromiseTracker",
                    href: "/",
                  },
                  {
                    label: "Terms of Service",
                    href: "/terms-of-service",
                  },
                  {
                    label: "Privacy Policy",
                    href: "/privacy-policy",
                  },
                ]
              }
              organizationLogo={{}}
              quickLinks={{
                primary: {
                  title: "About us",
                  links: [
                    {
                      label: "Our Team",
                      href: "/about/our-team",
                    },
                    {
                      label: "Contact Us",
                      href: "/about/contact-us",
                    },
                    {
                      label: "Partners",
                      href: "/about/partners",
                    },
                    {
                      label: "Supporters",
                      href: "/about/supporters",
                    },
                  ],
                },
                secondary: {
                  title: "More",
                  links: [
                    {
                      label: "Blog",
                      href: "/blog",
                    },
                    {
                      label: "Press",
                      href: "/press",
                    },
                    {
                      label: "Resources",
                      href: "/resources",
                    },
                    {
                      label: "FAQ",
                      href: "/faq",
                    },
                  ],
                },
              }}
              socialMedia={{
                title: "Stay in touch with us @",
                links: [
                  {
                    label: "Twitter",
                    platform: "Twitter",
                    href: "https://twitter.com/codeforafrica",
                  },
                  {
                    label: "Facebook",
                    platform: "Facebook",
                    href: "https://facebook.com/codeforafrica",
                  },
                  {
                    label: "Instagram",
                    platform: "Instagram",
                    href: "https://instagram.com/codeforafrica",
                  },
                ],
              }}
              description={`PromiseTracker, is a tool to help journalists and civil society
              watchdogs more easily track campaign promises and other political
              / government pledges, using official evidence / data, as well as
              crowdsourced information, with a transparent and defensible
              methodology, to help inject accountability and honesty into the
              often cavalier way that promises are made to citizens to win their
              support for elections, policies and contracts but are seldom
              honoured. 
              
              This site is an openAFRICA project of Code for Africa.
              All content is released under a Creative Commons 4 Attribution
              Licence. Reuse it to help empower your own community. The code is
              available on GitHub and data is available on openAFRICA.`}
            />
          </main>
        </Providers>
      </body>
    </html>
  );
}
