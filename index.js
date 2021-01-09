const github = require('@actions/github');
const { IncomingWebhook } = require('@slack/webhook');
const core = require('@actions/core');

const { GITHUB_TOKEN } = process.env;

async function sendToSlack(url, channel, message) {
  const webhook = new IncomingWebhook(url);
  await webhook.send({
    channel: channel,
    text: message
  })
}

function createLookup(slackLookupKeys) {
  let keys = slackLookupKeys.split(',');
  let arr = keys.map((key) => {
    let keyValuePair = key.split('|');
    let github = keyValuePair[0];
    let slack = keyValuePair[1];
    return {
      github,
      slack
    };
  });
  return function (github) {
    let found = arr.find((a) => a.github == github);
    if (found) {
      return found.slack;
    }
    return '';
  }
}

async function run() {
  const organization = core.getInput('organization');
  const repo = core.getInput('repo');
  const slackWebhook = core.getInput('slack-webhook');
  const channel = core.getInput('channel');
  const octokit = github.getOctokit(GITHUB_TOKEN)
  const req = await octokit.pulls.list({
    owner: organization,
    repo: repo,
    state: 'open'
  });
  let getSlackName = createLookup(core.getInput('slack-lookup'));

  let prs = req.data;
  let reviewsNeeds = prs.filter((pr) => pr.requested_reviewers.length);
  let msg = reviewsNeeds.map((pr) => {
    let msg = `${pr.title}, is waiting for your review: `
    msg += pr.requested_reviewers.map((reviewer) => {
      let slack = getSlackName(reviewer.login);
      return `<@${slack}>`;
    }).join(', ');
    msg += ` ${pr.html_url} \n`
    return msg;
  });
  try {
    await sendToSlack(slackWebhook, channel, msg.join('\n'));
  } catch (ex) {
    console.log('err', ex);
  }

}

run();