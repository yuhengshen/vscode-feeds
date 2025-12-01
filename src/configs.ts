import { defineConfigs } from 'reactive-vscode'

export const {
  'twitter.ct0': ct0,
  'twitter.authToken': authToken,
  'twitter.tweetsPerPage': tweetsPerPage,
  'twitter.autoRefreshInterval': autoRefreshInterval,
} = defineConfigs('vscode-feeds', {
  'twitter.ct0': String,
  'twitter.authToken': String,
  'twitter.tweetsPerPage': Number,
  'twitter.autoRefreshInterval': Number,
})

