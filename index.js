const SemanticReleaseError = require('@semantic-release/error')

const npmlog = require('npmlog')
const RegClient = require('npm-registry-client')
const findTag = require('find-tag-in-git-log')

function lastTagRelease(pluginConfig, settings, cb) {
  // settings {pkg, npm, plugins, options}
  var options = settings.options
  var npm = settings.npm

  npmlog.level = npm.loglevel || 'warn'
  let clientConfig = {log: npmlog}
  // disable retries for tests
  if (pluginConfig && pluginConfig.retry) clientConfig.retry = pluginConfig.retry
  const client = new RegClient(clientConfig)

  const packageUrl = settings.npm.registry + settings.pkg.name.replace('/', '%2f')

  client.get(packageUrl, {
    auth: settings.npm.auth
  }, (err, data) => {
    if (err && (
      err.statusCode === 404 ||
      /not found/i.test(err.message)
    )) {
      return cb(null, {})
    }

    if (err) return cb(err)

    let version = data['dist-tags'][settings.npm.tag]

    if (!version &&
      options &&
      options.fallbackTags &&
      options.fallbackTags[settings.npm.tag] &&
      data['dist-tags'][options.fallbackTags[settings.npm.tag]]) {
      version = data['dist-tags'][options.fallbackTags[settings.npm.tag]]
    }

    if (!version) {
      return cb(new SemanticReleaseError(
        'There is no release with the dist-tag "' + npm.tag + '" yet.\n' +
        'Tag a version manually or define "fallbackTags".', 'ENODISTTAG'))
    }

    cb(null, {
      version: version,
      gitHead: data.versions[version].gitHead,
      tag: npm.tag
    })
  })
}

module.exports = function (pluginConfig, settings, cb) {
  const n = 5 // number of commits to search
  findTag(n)
    .then(function (tag) {
      if (tag) {
        console.log('found tag "' + tag + '" in the git log')
        settings.npm.tag = tag
      } else {
        console.log('could not find custom tag in the git log')
      }
      lastTagRelease(pluginConfig, settings, cb)
    })
}
