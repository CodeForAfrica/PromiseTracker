import instagram from "@/promisetracker/assets/footer-social-ig.svg";
import facebook from "@/promisetracker/assets/footer-social-fb.svg";
import twitter from "@/promisetracker/assets/footer-social-tw.svg";
import linkedIn from "@/promisetracker/assets/footer-social-ln.svg";
import github from "@/promisetracker/assets/footer-social-gh.svg";
import cc from "@/promisetracker/assets/cc.svg";

import logo from "@/promisetracker/assets/logo-C4A.svg";

const WP_BACKEND_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost/wordpress"
    : "https://dashboard.hurumap.org";

const config = {
  WP_BACKEND_URL,
  WP_HURUMAP_DATA_API: `${WP_BACKEND_URL}/wp-json/hurumap-data`,
  DEFAULT_LANG: "en",

  title: "PromiseTracker",
  settings: {
    subscribe: {
      embedCode: `
        <!-- Begin Mailchimp Signup Form -->
        <link href="//cdn-images.mailchimp.com/embedcode/slim-10_7.css" rel="stylesheet" type="text/css">
        <style type="text/css">
          #mc_embed_signup{background:#fff; clear:left; font:14px Helvetica,Arial,sans-serif; }
        </style>
        <div id="mc_embed_signup">
        <form action="https://codeforafrica.us6.list-manage.com/subscribe/post?u=65e5825507b3cec760f272e79&amp;id=286e6e3985" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" class="validate" target="_blank" novalidate>
            <div id="mc_embed_signup_scroll">
          <label for="mce-EMAIL">Subscribe</label>
          <input type="email" value="" name="EMAIL" class="email" id="mce-EMAIL" placeholder="Enter your email address" required>
            <!-- real people should not fill this in and expect good things - do not remove this or risk form bot signups-->
            <div style="position: absolute; left: -5000px;" aria-hidden="true"><input type="text" name="b_65e5825507b3cec760f272e79_286e6e3985" tabindex="-1" value=""></div>
            <div class="clear"><input type="submit" value="" name="subscribe" id="mc-embedded-subscribe" class="button"></div>
            </div>
        </form>
        </div>
        <!--End mc_embed_signup-->
      `,
    },
  },
  page: {
    about: {
      about:
        "PromiseTracker, is a tool to help journalists and civil society watchdogs more easily track campaign promises and other political / government pledges, using official evidence / data, as well as crowdsourced information, with a transparent and defensible methodology, to help inject accountability and honesty into the often cavalier way that promises are made to citizens to win their support for elections, policies and contracts but are seldom honoured. ",
      initiative:
        "This site is an openAFRICA project of Code for Africa. All content is released under a Creative Commons 4 Attribution Licence. Reuse it to help empower your own community. The code is available on GitHub and data is available on openAFRICA.",
    },
    organization_logo: {
      image: logo,
      link: "//codeforafrica.org",
      alt: "CodeforAfrica",
    },
    copyright: {
      copyright: "PROMISE TRACKER",
      copyrightLogo: {
        image: { url: cc },
        link: "#",
        alt: "Promise Tracker",
      },
    },

    initiative_logo: {
      image:
        "https://dashboard.hurumap.org/wp-content/uploads/2020/05/pulitzer.png",
      link: "#",
      alt: "Pulitzer Center",
    },
    quick_links: [
      {
        title: "About Us",
        links: [
          {
            label: "The project",
            href: "/about/project",
          },
          {
            label: "The team",
            href: "/about/team",
          },
          {
            label: "The partners",
            href: "/about/partners",
          },
          {
            label: "Methodology",
            href: "/methodology",
          },
        ],
      },
      {
        title: "More",
        links: [
          {
            label: "Subscribe",
            href: "/subscribe",
          },
          {
            label: "Join Us",
            href: "/join",
          },
          {
            label: "FAQ",
            href: "/faq",
          },
          {
            label: "Resources",
            href: "/analysis/resources",
          },
        ],
      },
    ],
    legal_links: [
      {
        label: "PRIVACY POLICY",
        href: "/legal/privacy",
      },
      {
        label: "TERMS OF SERVICE",
        href: "/legal/terms",
      },
    ],
    contacts: {
      socialMedia: [
        {
          url: "https://github.com/codeforafrica",
          image: {
            url: instagram,
            alt: "",
          },
        },
        {
          url: "https://www.linkedin.com/company/code-for-africa/",
          image: {
            url: linkedIn,
            alt: "",
          },
        },
        {
          url:
            "https://twitter.com/Code4Africa?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor",
          image: {
            url: twitter,
            alt: "",
          },
        },
        {
          url: "https://www.facebook.com/CodeForAfrica/",
          image: {
            url: facebook,
            alt: "",
          },
        },
        {
          url: "https://github.com/codeforafrica",
          image: {
            url: github,
            alt: "",
          },
        },
      ],
    },
  },
  analysisMenu: {
    subnav: [
      {
        name: "Articles",
        href: "/analysis/articles",
      },
      {
        name: "Resources",
        href: "/analysis/resources",
      },
      {
        name: "Fact-checks",
        href: "/analysis/fact-checks",
      },
    ],
    title: "Analysis",
    url: "/analysis",
  },
};

export default config;
