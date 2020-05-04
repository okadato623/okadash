module.exports = function (workspaceName) {
  return {
    contents: [
      {
        name: "Slack",
        url: `https://${workspaceName}.slack.com`,
        size: "large",
        zoom: 1,
        customCSS: [
          ".p-channel_sidebar { width: 160px !important; }",
          ".p-classic_nav__team_header { display: none !important; }",
          ".p-workspace--context-pane-collapsed { grid-template-columns: 160px auto !important; }"
        ]
      },
      {
        name: "Google News",
        url: "https://news.google.com/",
        size: "medium",
        zoom: 1,
        customCSS: []
      },
      {
        name: "Slack(body)",
        url: `https://${workspaceName}.slack.com`,
        zoom: 1,
        customCSS: [
          ".p-workspace__sidebar { display: none !important; }",
          ".p-classic_nav__team_header { display: none !important;}",
          ".p-workspace--context-pane-collapsed { grid-template-columns: 0px auto !important;}",
          ".p-workspace--context-pane-expanded { grid-template-columns: 0px auto !important;}"
        ]
      },
      {
        name: "twitter",
        url: "https://twitter.com",
        zoom: 1,
        customCSS: ["header { display: none !important; }"]
      },
      {
        name: "calendar",
        zoom: 1,
        url: "https://okadash-files.s3-ap-northeast-1.amazonaws.com/calendar.html"
      }
    ]
  };
};
