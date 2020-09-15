export default {
  title: "PromiseTracker",

  settings: {
    subscribe: {
      embedCode: `
        <!-- Begin Mailchimp Signup Form -->
        <link href="//cdn-images.mailchimp.com/embedcode/slim-10_7.css" rel="stylesheet" type="text/css">
        <style type="text/css">
          #mc_embed_signup{background:#fff; clear:left; font:14px Helvetica,Arial,sans-serif; }
          /* Add your own Mailchimp form style overrides in your site stylesheet or in this style block.
             We recommend moving this block and the preceding CSS link to the HEAD of your HTML file. */
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
    join: {
      embedCode: `
        <!-- Begin Mailchimp Signup Form -->
        <link href="//cdn-images.mailchimp.com/embedcode/classic-10_7.css" rel="stylesheet" type="text/css">
        <style type="text/css">
          /* Add your own Mailchimp form style overrides in your site stylesheet or in this style block.
             We recommend moving this block and the preceding CSS link to the HEAD of your HTML file. */
        </style>
        <div id="mc_embed_signup">
        <form action="https://codeforafrica.us6.list-manage.com/subscribe/post?u=65e5825507b3cec760f272e79&amp;id=286e6e3985" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" class="validate" target="_blank" novalidate>
            <div id="mc_embed_signup_scroll">
          <h2>Subscribe</h2>
        <div class="indicates-required"><span class="asterisk">*</span> indicates required</div>
        <div class="mc-field-group">
          <label for="mce-EMAIL">Email Address  <span class="asterisk">*</span>
        </label>
          <input type="email" value="" name="EMAIL" class="required email" id="mce-EMAIL">
        </div>
        <div class="mc-field-group">
          <label for="mce-FNAME">First Name </label>
          <input type="text" value="" name="FNAME" class="" id="mce-FNAME">
        </div>
        <div class="mc-field-group">
          <label for="mce-LNAME">Last Name </label>
          <input type="text" value="" name="LNAME" class="" id="mce-LNAME">
        </div>
        <div class="mc-field-group size1of2">
          <label for="mce-PHONE">WhatsApp Number </label>
          <input type="text" name="PHONE" class="" value="" id="mce-PHONE">
        </div>
        <div class="mc-field-group">
          <label for="mce-MMERGE3">Organisation </label>
          <input type="text" value="" name="MMERGE3" class="" id="mce-MMERGE3">
        </div>
        <div class="mc-field-group input-group">
            <strong>Update Preferences </strong>
            <ul><li><input type="checkbox" value="1" name="group[13586][1]" id="mce-group[13586]-13586-0"><label for="mce-group[13586]-13586-0">Code for Africa news and project updates</label></li>
        <li><input type="checkbox" value="2" name="group[13586][2]" id="mce-group[13586]-13586-1"><label for="mce-group[13586]-13586-1">Outbreak.AFRICA alerts</label></li>
        <li><input type="checkbox" value="4" name="group[13586][4]" id="mce-group[13586]-13586-2"><label for="mce-group[13586]-13586-2">Misinformation updates</label></li>
        <li><input type="checkbox" value="8" name="group[13586][8]" id="mce-group[13586]-13586-3"><label for="mce-group[13586]-13586-3">New datasets</label></li>
        <li><input type="checkbox" value="16" name="group[13586][16]" id="mce-group[13586]-13586-4"><label for="mce-group[13586]-13586-4">New research papers</label></li>
        <li><input type="checkbox" value="32" name="group[13586][32]" id="mce-group[13586]-13586-5"><label for="mce-group[13586]-13586-5">New coalition members</label></li>
        <li><input type="checkbox" value="64" name="group[13586][64]" id="mce-group[13586]-13586-6"><label for="mce-group[13586]-13586-6">How to support Outbreak.AFRICA</label></li>
        </ul>
        </div>
          <div id="mce-responses" class="clear">
            <div class="response" id="mce-error-response" style="display:none"></div>
            <div class="response" id="mce-success-response" style="display:none"></div>
          </div>    <!-- real people should not fill this in and expect good things - do not remove this or risk form bot signups-->
            <div style="position: absolute; left: -5000px;" aria-hidden="true"><input type="text" name="b_65e5825507b3cec760f272e79_286e6e3985" tabindex="-1" value=""></div>
            <div class="clear"><input type="submit" value="Subscribe" name="subscribe" id="mc-embedded-subscribe" class="button"></div>
            </div>
        </form>
        </div>
        <script type='text/javascript' src='//s3.amazonaws.com/downloads.mailchimp.com/js/mc-validate.js'></script><script type='text/javascript'>(function($) {window.fnames = new Array(); window.ftypes = new Array();fnames[0]='EMAIL';ftypes[0]='email';fnames[1]='FNAME';ftypes[1]='text';fnames[2]='LNAME';ftypes[2]='text';fnames[4]='PHONE';ftypes[4]='phone';fnames[3]='MMERGE3';ftypes[3]='text';}(jQuery));var $mcj = jQuery.noConflict(true);</script>
        <!--End mc_embed_signup-->
      `,
    },
    support: {
      hello: "hello@codeforafrica.org",
      support: "support@codeforafrica.org",
    },
    socialMedia: {
      facebook: "https://facebook.com/CodeForAfrica",
      twitter: "https://twitter.com/Code4Africa",
      medium: "https://medium.com/code-for-africa",
      linkedin: "https://www.linkedin.com/company/code-for-africa/",
    },
    address: {
      locality: "84 Shortmarket St, Cape Town City Centre",
      region: "Cape Town",
      country: "South Africa",
      postalCode: "00100",
    },
  },
};
