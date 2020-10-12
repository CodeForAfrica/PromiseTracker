const WP_BACKEND_URL =
  process.env.NODE_ENV === "development"
    ? "https://dashboard.hurumap.org/promisetracker"
    : "https://dashboard.hurumap.org/promisetracker";

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
  page: {},
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
  promiseStatuses: [
    {
      color: "#005DFD",
      description: "The promise is mostly or completely fulfilled.",
      textColor: "#FFFFFF",
      title: "Completed",
      year: 2014.4,
    },
    {
      color: "#90DAFF",
      description: "The promise is in the works or being considered.",
      title: "In Progress",
      year: 2013.4,
    },
    {
      color: "#FF5255",
      description:
        "Could occur due to inaction by administration or lack of support from legislative branch.",
      textColor: "#FFFFFF",
      title: "Stalled",
      year: 2015.4,
    },
    {
      color: "#FFB322",
      description:
        "No progress, perhaps due to financial limitations, opposition from lawmakers or a change in priorities.",
      title: "Delayed",
      year: 2016.4,
    },
    {
      color: "#EBEBEB",
      description:
        "Every promise begins at this level and retains this rating until evidence of progress or proof that it has been shelved.",
      title: "Unrated",
      year: 2016.4,
    },
    {
      color: "#909090",
      description:
        "The promise is accomplished only in part, but has succeeded at least in part consistently with the goal of the promise.",
      textColor: "#FFFFFF",
      title: "Unstarted",
      year: 2014.4,
    },
  ],
  pages: {
    about: {
      pages: {
        project: {
          content: `
            <p>Engaging with governments needs data, to this end, this project not only develops a promise tracker but also showcases this information on an easy-to-understand platform, making the PromiseTracker a contributor to public discourse around service delivery by elected officials. This leads to a more robust dialogue and positive engagement with the elected officials or government bodies around this subject.
            <p>The PromiseTracker initial focus will be on Nairobi tracking progress on Governor Mike Sonko’s seven-point plan to improve the city in the first 100 days of his term and 5 year plan. The tracker will also focus on other county governors whose plans are elaborated in their manifestos, such as Makueni, Mombasa, Kisumu, Nakuru, Kitui and Nandi. While the promises made by the national government have been covered extensively, promises made by the governors have received less coverage, resulting in limited analysis around whether they are actually viable.
          `,
          description:
            "The promise tracker is a platform-based promise tracker where citizens can track various promises and services promised by governors, institutions, political parties in their manifestos during the campaigns leading up to the elections and in the post election period.",
          title: "The Project",
        },
        team: {
          content: `
            <p>Engaging with governments needs data, to this end, this project not only develops a promise tracker but also showcases this information on an easy-to-understand platform, making the PromiseTracker a contributor to public discourse around service delivery by elected officials. This leads to a more robust dialogue and positive engagement with the elected officials or government bodies around this subject.
            <p>The PromiseTracker initial focus will be on Nairobi tracking progress on Governor Mike Sonko’s seven-point plan to improve the city in the first 100 days of his term and 5 year plan. The tracker will also focus on other county governors whose plans are elaborated in their manifestos, such as Makueni, Mombasa, Kisumu, Nakuru, Kitui and Nandi. While the promises made by the national government have been covered extensively, promises made by the governors have received less coverage, resulting in limited analysis around whether they are actually viable.
          `,
          description:
            "The promise tracker is a platform-based promise tracker where citizens can track various promises and services promised by governors, institutions, political parties in their manifestos during the campaigns leading up to the elections and in the post election period.",
          title: "The Team",
        },
        partners: {
          content: `
            <p>Engaging with governments needs data, to this end, this project not only develops a promise tracker but also showcases this information on an easy-to-understand platform, making the PromiseTracker a contributor to public discourse around service delivery by elected officials. This leads to a more robust dialogue and positive engagement with the elected officials or government bodies around this subject.
            <p>The PromiseTracker initial focus will be on Nairobi tracking progress on Governor Mike Sonko’s seven-point plan to improve the city in the first 100 days of his term and 5 year plan. The tracker will also focus on other county governors whose plans are elaborated in their manifestos, such as Makueni, Mombasa, Kisumu, Nakuru, Kitui and Nandi. While the promises made by the national government have been covered extensively, promises made by the governors have received less coverage, resulting in limited analysis around whether they are actually viable.
          `,
          description:
            "The promise tracker is a platform-based promise tracker where citizens can track various promises and services promised by governors, institutions, political parties in their manifestos during the campaigns leading up to the elections and in the post election period.",
          title: "The Partners",
        },
        methodology: {
          content: `
            <p>Engaging with governments needs data, to this end, this project not only develops a promise tracker but also showcases this information on an easy-to-understand platform, making the PromiseTracker a contributor to public discourse around service delivery by elected officials. This leads to a more robust dialogue and positive engagement with the elected officials or government bodies around this subject.
            <p>The PromiseTracker initial focus will be on Nairobi tracking progress on Governor Mike Sonko’s seven-point plan to improve the city in the first 100 days of his term and 5 year plan. The tracker will also focus on other county governors whose plans are elaborated in their manifestos, such as Makueni, Mombasa, Kisumu, Nakuru, Kitui and Nandi. While the promises made by the national government have been covered extensively, promises made by the governors have received less coverage, resulting in limited analysis around whether they are actually viable.
          `,
          description:
            "The promise tracker is a platform-based promise tracker where citizens can track various promises and services promised by governors, institutions, political parties in their manifestos during the campaigns leading up to the elections and in the post election period.",
          title: "Methodology",
        },
      },
    },
  },
};

config.pages.about.pages.project.criteria = {
  items: config.promiseStatuses,
  title: "Promise Criteria",
};

export default config;
