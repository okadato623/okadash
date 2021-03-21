module.exports = function (workspaceName) {
  return {
    contents: [
      {
        name: "Slack",
        url: `https://${workspaceName}.slack.com`,
        zoom: 1,
        customCSS: []
      },
      {
        name: "Google News",
        url: "https://news.google.com/",
        zoom: 1,
        customCSS: []
      },
      {
        name: "Slack(body)",
        url: `https://${workspaceName}.slack.com`,
        zoom: 1,
        customCSS: [
          ".p-workspace__sidebar { display: none !important; }",
          ".p-workspace-layout { grid-template-columns: 0px auto; }"
        ]
      },
      {
        name: "twitter",
        url: "https://twitter.com",
        zoom: 1
      },
      {
        name: "calendar",
        zoom: 1,
        url: "https://okadash-files.s3-ap-northeast-1.amazonaws.com/calendar.html"
      }
    ]
  };
};
