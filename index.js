/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
var githubhook = require('githubhook');
var github = githubhook({
  port:process.env.PORT || 5000,
  path: process.env.ENTRY_POINT
});

var GitHubAPI = require('github');
var githubClient = new GitHubAPI({ });

githubClient.authenticate({
  type: 'token',
  path: process.env.ACCESS_TOKEN
});

github.listen();

github.on('pull_request', function (nazo1, nazo2, payload) {
  var repository = payload.repository;

  var repo = repository.name;
  var owner = repository.owner.login;
  var number = payload.number;
  var pullRequestUrl = payload.pull_request.html_url;

  githubClient.pullRequests.getCommits({
    repo: repo,
    owner: owner,
    number: number
  }).then(function(commits){
    var mergeCommits = commits.filter(function(commit) {
      return commit.commit.message.indexOf('Merge pull request') >= 0;
    }).map(function(commit){
      var match = commit.commit.message.match(/Merge pull request #[0-9]+ from (.*)$/);
      var token = commit.commit.message.split('#')[1].split(' from ');
      var number = token[0];
      var title = token[1];

      return {
        number: number,
        title: title
      };
    });

    return mergeCommits;
  }).then(function(mergeCommits){
    var promiseList = mergeCommits.map(function(merge){
      return githubClient.pullRequests.get({
        repo: repo,
        owner: owner,
        number: merge.number
      });
    });

    return Promise.all(promiseList);
  }).then(function(pulls){

    var releseContents = pulls.map(function(pull){
      return '#' + pull.number + ' ' + pull.title;
    }).join('\n');

    var developers = pulls.map(function(pull){
      return pull.user.login;
    });

    var reviewers = pulls.reduce(function(result, pull){
      return result.concat(pull.assignees);
    },[]);

    var body = [
      "サービス:" + repo,
      "PR:" + pullRequestUrl,
      '内容:',
      releseContents,
      '実装者:' + developers.join(','),
      'レビュワー:' + reviewers.join(',')
    ].join('\n');
    
    var request = {
      repo: repo,
      owner: owner,
      number: number,
      body: body
    };
    return githubClient.issues.edit( request, function(err, res) {
      console.log(err);
      console.log(res);
    });
  });
  return;
});
